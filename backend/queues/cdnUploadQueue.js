const { Queue, Worker } = require('bullmq')
const connection = require('../utils/redisClient')

const cdnUploadQueue = new Queue('cdnUploadQueue', { connection })

// Helper function to dynamically load the ESM BOLPhoto model
let _BOLPhoto
async function getBOLPhoto() {
  if (_BOLPhoto) return _BOLPhoto
  const mod = await import('../models/FuelRec.js')
  _BOLPhoto = mod.BOLPhoto || mod.default
  return _BOLPhoto
}

/**
 * Direct binary pipeline helper to upload stream/buffer to CDN container
 */
async function uploadToCdn(fileBuffer, originalName, mimeType = 'image/jpeg') {
  const formData = new FormData()
  // Re-construct Blob from Buffer in Node environment
  const fileBlob = new Blob([Buffer.from(fileBuffer)], { type: mimeType })
  formData.append('file', fileBlob, originalName)

  const response = await fetch('http://cdn:5001/cdn/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`CDN server rejected upload with status: ${response.status}`)
  }

  const data = await response.json()
  // Extract filename returned by CDN (e.g. data.filename or parsed from data.url)
  return data.filename || data.fileName
}

const cdnUploadWorker = new Worker(
  'cdnUploadQueue',
  async (job) => {
    const { recordId, originalName, buffer, mimeType } = job.data
    console.log(`🤖 [CDN Worker] Piping direct binary buffer to CDN for Record ID: ${recordId}`)

    // 1. Pipe binary buffer directly to CDN
    const finalFilename = await uploadToCdn(buffer, originalName, mimeType)

    if (!finalFilename) {
      throw new Error(`CDN upload returned invalid or empty filename.`)
    }

    // 2. Fetch Mongoose model dynamically
    const BOLPhoto = await getBOLPhoto()

    // 3. Update MongoDB document with the final CDN filename
    const updated = await BOLPhoto.findByIdAndUpdate(
      recordId,
      {
        $set: {
          filename: finalFilename,
          uploadStatus: 'completed',
        },
      },
      { new: true }
    )

    console.log(`🎉 [CDN Worker] Successfully attached CDN filename '${finalFilename}' to Record ${recordId}`)
    return updated
  },
  {
    connection,
    concurrency: 2,
    stalledInterval: 45000,
    maxStalledCount: 1,
  }
)

cdnUploadWorker.on('failed', (job, err) => {
  console.error(`❌ [CDN Worker] Job ${job?.id} failed for Record ID ${job?.data?.recordId}:`, err)
})

module.exports = { cdnUploadQueue, cdnUploadWorker }