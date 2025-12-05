const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { BlobServiceClient } = require("@azure/storage-blob");

// Root backup folder
const ROOT_BACKUP_DIR = path.join(__dirname, "mongo-backups");

// Number of days to keep backups
const RETENTION_DAYS = 20;

// Main backup function
async function runBackup() {
  try {
    // Create root backup folder if it doesn't exist
    if (!fs.existsSync(ROOT_BACKUP_DIR)) {
      fs.mkdirSync(ROOT_BACKUP_DIR, { recursive: true });
    }

    // Timestamped folder for this backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFolder = path.join(ROOT_BACKUP_DIR, `backup-${timestamp}`);

    const mongoUri = process.env.MONGO_URI;
    const containerName = process.env.AZURE_CONTAINER;
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    // --- 1️⃣ Run MongoDB dump ---
    console.log("➤ Running mongodump...");
    const dumpCommand = `mongodump --uri="${mongoUri}" --out="${backupFolder}"`;
    await execPromise(dumpCommand);
    console.log("✔ Mongodump completed in folder:", backupFolder);

    // --- 2️⃣ Compress backup for Azure ---
    const archiveFile = `${backupFolder}.tar.gz`;
    console.log("➤ Compressing backup...");
    await execPromise(`tar -czvf ${archiveFile} -C ${ROOT_BACKUP_DIR} ${path.basename(backupFolder)}`);
    console.log("✔ Compression complete:", archiveFile);

    // --- 3️⃣ Upload to Azure Blob ---
    console.log("➤ Uploading to Azure Blob...");
    const blobService = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobService.getContainerClient(containerName);

    const blobName = `mongo-backups/backup-${timestamp}.tar.gz`;
    const blockBlob = containerClient.getBlockBlobClient(blobName);
    await blockBlob.uploadFile(archiveFile);
    console.log("✔ Uploaded to Azure:", blobName);

    // --- 4️⃣ Cleanup local archive ---
    fs.unlinkSync(archiveFile);
    console.log("✔ Local archive removed. Backup folder kept for direct restore:", backupFolder);

    // --- 5️⃣ Cleanup old backups (retention) ---
    cleanupOldBackups();
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

// Function to delete backup folders older than RETENTION_DAYS
function cleanupOldBackups() {
  const files = fs.readdirSync(ROOT_BACKUP_DIR);
  const now = Date.now();

  files.forEach(file => {
    const fullPath = path.join(ROOT_BACKUP_DIR, file);
    if (!fs.lstatSync(fullPath).isDirectory()) return;

    const stats = fs.statSync(fullPath);
    const ageInDays = (now - stats.ctimeMs) / (1000 * 60 * 60 * 24);

    if (ageInDays > RETENTION_DAYS) {
      console.log(`🗑 Deleting old backup folder: ${file}`);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  });
}

// Run backup when script is executed directly
if (require.main === module) {
  runBackup();
}

module.exports = runBackup;