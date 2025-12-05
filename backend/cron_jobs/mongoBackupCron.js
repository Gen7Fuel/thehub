const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { BlobServiceClient } = require("@azure/storage-blob");

// Temporary local backup folder
const TEMP_BACKUP_DIR = path.join(__dirname, "mongo-backups-temp");

// Number of days to keep backups on Azure
const RETENTION_DAYS = 20;

// Main backup function
async function runBackup() {
  try {
    // --- 1️⃣ Create temporary folder for this backup ---
    if (!fs.existsSync(TEMP_BACKUP_DIR)) {
      fs.mkdirSync(TEMP_BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFolder = path.join(TEMP_BACKUP_DIR, `backup-${timestamp}`);

    const mongoUri = process.env.MONGO_URI;
    const containerName = process.env.AZURE_CONTAINER;
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    // --- 2️⃣ Run mongodump ---
    console.log("➤ Running mongodump...");
    const dumpCommand = `mongodump --uri="${mongoUri}" --out="${backupFolder}"`;
    await execPromise(dumpCommand);
    console.log("✔ Mongodump completed:", backupFolder);

    // --- 3️⃣ Compress backup ---
    const archiveFile = `${backupFolder}.tar.gz`;
    console.log("➤ Compressing backup...");
    await execPromise(`tar -czvf ${archiveFile} -C ${TEMP_BACKUP_DIR} ${path.basename(backupFolder)}`);
    console.log("✔ Compression complete:", archiveFile);

    // --- 4️⃣ Upload to Azure ---
    console.log("➤ Uploading to Azure Blob...");
    const blobService = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobService.getContainerClient(containerName);

    const blobName = `mongo-backups/backup-${timestamp}.tar.gz`;
    const blockBlob = containerClient.getBlockBlobClient(blobName);
    await blockBlob.uploadFile(archiveFile);
    console.log("✔ Uploaded to Azure:", blobName);

    // --- 5️⃣ Remove local backup folder and archive ---
    fs.rmSync(backupFolder, { recursive: true, force: true });
    fs.unlinkSync(archiveFile);
    console.log("✔ Local temporary files removed");

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

    for await (const blob of containerClient.listBlobsFlat({ prefix: "mongo-backups/" })) {
      // Extract timestamp from blob name
      const match = blob.name.match(/backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+)Z\.tar\.gz$/);
      if (!match) continue;

      const timestamp = match[1].replace(/-/g, ":"); // Convert back to ISO format
      const blobTime = new Date(timestamp).getTime();
      const ageInDays = (now - blobTime) / (1000 * 60 * 60 * 24);

      if (ageInDays > RETENTION_DAYS) {
        console.log(`🗑 Deleting old Azure backup: ${blob.name}`);
        const blockBlob = containerClient.getBlockBlobClient(blob.name);
        await blockBlob.delete();
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