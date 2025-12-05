const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { BlobServiceClient } = require("@azure/storage-blob");

// Temporary local backup folder
// const TEMP_BACKUP_DIR = path.join(__dirname, "mongo-backups-temp");

// Number of days to keep backups on Azure
const RETENTION_DAYS = 5;

// Main backup function
async function runBackup() {
  try {
    const mongoUri = process.env.MONGO_URI;
    const containerName = process.env.AZURE_CONTAINER;
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // --- 1️⃣ Define dump directory and archive file directly ---
    const dumpDir = path.join(__dirname, `dump-${timestamp}`); // direct dump folder (single)
    const archiveFile = path.join(__dirname, `backup-${timestamp}.tar.gz`);

    // --- 2️⃣ Run mongodump ---
    console.log("➤ Running mongodump...");
    const dumpCommand = `mongodump --uri="${mongoUri}" --out="${dumpDir}"`;
    await execPromise(dumpCommand);
    console.log("✔ Mongodump completed:", dumpDir);

    // --- 3️⃣ Compress dump ---
    console.log("➤ Compressing backup...");
    await execPromise(`tar -czvf ${archiveFile} -C ${__dirname} ${path.basename(dumpDir)}`);
    console.log("✔ Compression complete:", archiveFile);

    // --- 4️⃣ Upload to Azure ---
    console.log("➤ Uploading to Azure Blob...");
    const blobService = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobService.getContainerClient(containerName);

    const dateFolderName = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const blobName = `mongo-backups/${dateFolderName}/backup-${timestamp}.tar.gz`;
    const blockBlob = containerClient.getBlockBlobClient(blobName);
    await blockBlob.uploadFile(archiveFile);
    await blockBlob.setAccessTier('Hot');
    console.log("✔ Uploaded to Azure:", blobName);

    // --- 5️⃣ Cleanup local dump and archive ---
    await fs.promises.rm(dumpDir, { recursive: true, force: true });
    await fs.promises.unlink(archiveFile);
    console.log("✔ Local dump and archive removed");

    // --- 6️⃣ Cleanup old backups on Azure ---
    await cleanupOldBlobs(containerClient);

  } catch (err) {
    console.error("❌ Backup failed:", err);
  }
}

// Helper function to run shell commands as promises
function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

// Delete blobs older than RETENTION_DAYS
async function cleanupOldBlobs(containerClient) {
  try {
    const now = Date.now();
    const prefix = "mongo-backups/"; // root folder in blob

    // List all blobs with their prefixes
    const folders = new Set();
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      // Extract date folder (e.g., mongo-backups/20251205/ => 20251205)
      const parts = blob.name.split("/");
      if (parts.length >= 2) {
        folders.add(parts[1]);
      }
    }

    for (const folderName of folders) {
      // Parse folder name as YYYYMMDD
      const folderDate = new Date(
        `${folderName.slice(0,4)}-${folderName.slice(4,6)}-${folderName.slice(6,8)}T00:00:00Z`
      ).getTime();

      const ageInDays = (now - folderDate) / (1000 * 60 * 60 * 24);
      if (ageInDays > RETENTION_DAYS) {
        console.log(`🗑 Deleting old Azure backup folder: ${folderName}`);

        // Delete all blobs under this folder
        for await (const blob of containerClient.listBlobsFlat({ prefix: `${prefix}${folderName}/` })) {
          const blockBlob = containerClient.getBlockBlobClient(blob.name);
          await blockBlob.delete();
        }
      }
    }
  } catch (err) {
    console.error("❌ Azure cleanup failed:", err);
  }
}

// Run backup if executed directly
if (require.main === module) {
  runBackup();
}

module.exports = runBackup;