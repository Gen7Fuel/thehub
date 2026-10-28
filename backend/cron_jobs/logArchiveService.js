const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { createGzip } = require('zlib');
const mongoose = require('mongoose');
const { BlobServiceClient } = require('@azure/storage-blob');
const AccessLog = require('../models/AccessLog');
const ChangeLog = require('../models/ChangeLog');

const DEFAULT_THRESHOLD = 50_000;
const DEFAULT_SAFE_DAYS = 2;
const LOCK_NAME = 'log-archive';
const LOCK_LEASE_MS = 12 * 60 * 60 * 1000;
const DELETE_BATCH_SIZE = 1_000;

const ARCHIVE_TYPES = {
  access: { model: AccessLog, folder: 'access' },
  change: { model: ChangeLog, folder: 'change' },
};

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function utcDayStart(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getArchiveCutoff(now = new Date(), safeDays = DEFAULT_SAFE_DAYS) {
  const cutoff = utcDayStart(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - safeDays);
  return cutoff;
}

function addUtcDays(value, days) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function utcDatePath(value) {
  const date = new Date(value);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return { year, month, day, label: `${year}-${month}-${day}` };
}

function serializeLog(document) {
  return `${JSON.stringify(document)}\n`;
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest('hex');
}

async function writeUtcDayArchive(model, dayStart, dayEnd, tempFilePath) {
  const recordIds = [];
  let firstCreatedAt;
  let lastCreatedAt;

  const cursor = model.find({
    createdAt: { $gte: dayStart, $lt: dayEnd },
  }).sort({ createdAt: 1, _id: 1 }).lean().cursor();

  const source = Readable.from((async function* generateJsonLines() {
    for await (const document of cursor) {
      recordIds.push(document._id);
      firstCreatedAt ||= document.createdAt;
      lastCreatedAt = document.createdAt;
      yield serializeLog(document);
    }
  })());

  await pipeline(source, createGzip({ level: 9 }), fs.createWriteStream(tempFilePath));
  const stats = await fsp.stat(tempFilePath);

  return {
    recordIds,
    recordCount: recordIds.length,
    firstCreatedAt,
    lastCreatedAt,
    contentLength: stats.size,
    sha256: await sha256File(tempFilePath),
  };
}

async function uploadAndVerify(containerClient, blobName, filePath, metadata) {
  const blob = containerClient.getBlockBlobClient(blobName);
  await blob.uploadFile(filePath, {
    tier: process.env.LOG_ARCHIVE_TIER || 'Cold',
    blobHTTPHeaders: {
      blobContentType: 'application/x-ndjson',
      blobContentEncoding: 'gzip',
    },
    metadata,
    conditions: { ifNoneMatch: '*' },
  });

  const properties = await blob.getProperties();
  if (properties.contentLength !== Number(metadata.contentlength)
    || properties.metadata?.sha256 !== metadata.sha256
    || properties.metadata?.recordcount !== metadata.recordcount) {
    throw new Error(`Blob verification failed for ${blobName}`);
  }

  return properties;
}

async function uploadManifest(containerClient, blobName, manifest) {
  const manifestBlobName = blobName.replace(/\.jsonl\.gz$/, '.manifest.json');
  const body = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const blob = containerClient.getBlockBlobClient(manifestBlobName);
  await blob.uploadData(body, {
    tier: process.env.LOG_ARCHIVE_TIER || 'Cold',
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
    conditions: { ifNoneMatch: '*' },
  });
  return manifestBlobName;
}

async function deleteArchivedRecords(model, recordIds) {
  let deletedCount = 0;
  for (let offset = 0; offset < recordIds.length; offset += DELETE_BATCH_SIZE) {
    const batch = recordIds.slice(offset, offset + DELETE_BATCH_SIZE);
    const result = await model.deleteMany({ _id: { $in: batch } });
    deletedCount += result.deletedCount || 0;
  }
  return deletedCount;
}

async function archiveUtcDay({ model, folder, dayStart, containerClient }) {
  const dayEnd = addUtcDays(dayStart, 1);
  const date = utcDatePath(dayStart);
  const tempDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'hub-log-archive-'));
  const tempFilePath = path.join(tempDirectory, `${folder}-${date.label}.jsonl.gz`);

  try {
    const archive = await writeUtcDayArchive(model, dayStart, dayEnd, tempFilePath);
    if (archive.recordCount === 0) return null;

    const batchId = crypto.randomUUID();
    const blobName = `hub/logs/${folder}/${date.year}/${date.month}/${date.day}/${folder}-${date.label}-${batchId}.jsonl.gz`;
    const metadata = {
      schemaversion: '1',
      collection: model.collection.collectionName,
      archivedateutc: date.label,
      recordcount: String(archive.recordCount),
      contentlength: String(archive.contentLength),
      sha256: archive.sha256,
      compression: 'gzip',
      batchid: batchId,
    };

    await uploadAndVerify(containerClient, blobName, tempFilePath, metadata);
    const manifestBlobName = await uploadManifest(containerClient, blobName, {
      schemaVersion: 1,
      collection: model.collection.collectionName,
      archiveDateUtc: date.label,
      range: {
        fromInclusive: dayStart.toISOString(),
        toExclusive: dayEnd.toISOString(),
      },
      recordCount: archive.recordCount,
      contentLength: archive.contentLength,
      sha256: archive.sha256,
      compression: 'gzip',
      format: 'json-lines',
      blobTier: process.env.LOG_ARCHIVE_TIER || 'Cold',
      dataBlob: blobName,
      batchId,
      exportedAt: new Date().toISOString(),
      firstCreatedAt: archive.firstCreatedAt?.toISOString?.() || archive.firstCreatedAt,
      lastCreatedAt: archive.lastCreatedAt?.toISOString?.() || archive.lastCreatedAt,
    });
    const deletedCount = await deleteArchivedRecords(model, archive.recordIds);
    if (deletedCount !== archive.recordCount) {
      throw new Error(
        `Archived ${archive.recordCount} ${folder} records but deleted ${deletedCount}; `
        + `the blob is safe at ${blobName}, but manual reconciliation is required`,
      );
    }

    console.log(`Archived ${archive.recordCount} ${folder} logs for ${date.label} UTC to ${blobName}`);
    return {
      blobName,
      manifestBlobName,
      recordCount: archive.recordCount,
      contentLength: archive.contentLength,
      sha256: archive.sha256,
      deletedCount,
      day: date.label,
    };
  } finally {
    await fsp.rm(tempDirectory, { recursive: true, force: true });
  }
}

async function acquireArchiveLock() {
  const owner = crypto.randomUUID();
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LOCK_LEASE_MS);
  const locks = mongoose.connection.collection('cron_locks');

  try {
    const result = await locks.findOneAndUpdate(
      {
        _id: LOCK_NAME,
        $or: [
          { lockedUntil: { $lte: now } },
          { lockedUntil: { $exists: false } },
        ],
      },
      { $set: { owner, lockedUntil, updatedAt: now } },
      { upsert: true, returnDocument: 'after' },
    );
    const lock = result?.value || result;
    return lock?.owner === owner ? owner : null;
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
}

async function releaseArchiveLock(owner) {
  if (!owner) return;
  await mongoose.connection.collection('cron_locks').updateOne(
    { _id: LOCK_NAME, owner },
    { $set: { lockedUntil: new Date(0), updatedAt: new Date() }, $unset: { owner: '' } },
  );
}

function normalizeTypes(types) {
  const requested = types?.length ? types : Object.keys(ARCHIVE_TYPES);
  for (const type of requested) {
    if (!ARCHIVE_TYPES[type]) throw new Error(`Unknown log archive type: ${type}`);
  }
  return [...new Set(requested)];
}

async function archiveCollection({ type, threshold, safeDays, now, containerClient }) {
  const config = ARCHIVE_TYPES[type];
  const documentCount = await config.model.countDocuments({});
  if (documentCount <= threshold) {
    console.log(`Skipping ${type} logs: ${documentCount} documents does not exceed ${threshold}`);
    return { type, documentCount, archived: [] };
  }

  const cutoff = getArchiveCutoff(now, safeDays);
  const oldest = await config.model.findOne({ createdAt: { $lt: cutoff } })
    .sort({ createdAt: 1, _id: 1 })
    .select({ createdAt: 1 })
    .lean();

  if (!oldest) {
    console.log(`Skipping ${type} logs: no records are older than ${cutoff.toISOString()}`);
    return { type, documentCount, cutoff, archived: [] };
  }

  const archived = [];
  for (let day = utcDayStart(oldest.createdAt); day < cutoff; day = addUtcDays(day, 1)) {
    const result = await archiveUtcDay({
      model: config.model,
      folder: config.folder,
      dayStart: day,
      containerClient,
    });
    if (result) archived.push(result);
  }

  return { type, documentCount, cutoff, archived };
}

async function runLogArchive(options = {}) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_CONTAINER;
  if (!connectionString || !containerName) {
    throw new Error('Missing AZURE_STORAGE_CONNECTION_STRING or AZURE_CONTAINER');
  }
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB must be connected before running log archival');
  }

  const threshold = positiveInteger(
    options.threshold ?? process.env.LOG_ARCHIVE_DOCUMENT_THRESHOLD,
    DEFAULT_THRESHOLD,
    'LOG_ARCHIVE_DOCUMENT_THRESHOLD',
  );
  const safeDays = positiveInteger(
    options.safeDays ?? process.env.LOG_ARCHIVE_SAFE_DAYS,
    DEFAULT_SAFE_DAYS,
    'LOG_ARCHIVE_SAFE_DAYS',
  );
  const types = normalizeTypes(options.types);
  const now = options.now ? new Date(options.now) : new Date();
  const owner = await acquireArchiveLock();
  if (!owner) {
    console.log('Skipping log archival because another instance holds the archive lock');
    return { skipped: 'locked', results: [] };
  }

  try {
    const blobService = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobService.getContainerClient(containerName);
    const results = [];
    for (const type of types) {
      results.push(await archiveCollection({ type, threshold, safeDays, now, containerClient }));
    }
    return { threshold, safeDays, cutoff: getArchiveCutoff(now, safeDays), results };
  } finally {
    await releaseArchiveLock(owner);
  }
}

module.exports = {
  DEFAULT_SAFE_DAYS,
  DEFAULT_THRESHOLD,
  getArchiveCutoff,
  normalizeTypes,
  runLogArchive,
  utcDatePath,
};
