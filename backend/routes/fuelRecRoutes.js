const express = require('express')
const router = express.Router()
const { emailQueue } = require('../queues/emailQueue');

// JSON body parsing
router.use(express.json({ limit: '1mb' }))

// Bridge to ESM auth middleware
let _auth
async function getAuth() {
  if (_auth) return _auth
  const mod = await import('../middleware/authMiddleware.js')
  _auth = mod.auth
  return _auth
}
router.use(async (req, res, next) => {
  try {
    const auth = await getAuth()
    return auth(req, res, next)
  } catch (e) {
    console.error('fuelRecRoutes auth bridge error:', e)
    return res.status(500).json({ error: 'Auth middleware load failed' })
  }
})

// Bridge to ESM BOLPhoto model
let _BOLPhoto
async function getBOLPhoto() {
  if (_BOLPhoto) return _BOLPhoto
  const mod = await import('../models/FuelRec.js')
  _BOLPhoto = mod.BOLPhoto || mod.default
  return _BOLPhoto
}

const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

// POST /api/fuel-rec/capture
// body: { site: string, date: 'YYYY-MM-DD', photo: string, bolNumber: string }  // photo = filename from CDN
router.post('/capture', async (req, res) => {
  const site = String(req.body?.site || '').trim()
  const date = String(req.body?.date || '').trim()
  const filename = String(req.body?.photo || '').trim()
  const bolNumber = String(req.body?.bolNumber || '').trim()

  if (!site || !isYmd(date) || !filename || !bolNumber) {
    return res.status(400).json({ error: 'site, date (YYYY-MM-DD), photo filename and bolNumber are required' })
  }

  try {
    const BOLPhoto = await getBOLPhoto()
    const saved = await BOLPhoto.findOneAndUpdate(
      { site, date, filename },
      { $setOnInsert: { site, date, filename }, $set: { bolNumber } },
      { new: true, upsert: true }
    ).lean()

    return res.status(200).json({ saved: true, photo: saved })
  } catch (e) {
    if (e && e.code === 11000) {
      const BOLPhoto = await getBOLPhoto()
      const existing = await BOLPhoto.findOne({ site, date, filename }).lean()
      return res.status(200).json({ saved: true, photo: existing })
    }
    console.error('fuelRec.capture error:', e)
    return res.status(500).json({ error: 'Failed to save BOL photo' })
  }
})

// GET /api/fuel-rec/list?site=...&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/list', async (req, res) => {
  try {
    const site = String(req.query?.site || '').trim()
    let from = String(req.query?.from || '').trim()
    let to = String(req.query?.to || '').trim()

    if (!site) return res.status(400).json({ error: 'site is required' })
    if (from && !isYmd(from)) return res.status(400).json({ error: 'from must be YYYY-MM-DD' })
    if (to && !isYmd(to)) return res.status(400).json({ error: 'to must be YYYY-MM-DD' })

    if (from && to && from > to) [from, to] = [to, from]

    const filter = { site }
    if (from || to) {
      const range = {}
      if (from) range.$gte = from
      if (to) range.$lte = to
      filter.date = range
    }

    const BOLPhoto = await getBOLPhoto()
    const entries = await BOLPhoto.find(filter).sort({ date: -1, createdAt: -1 }).lean()

    return res.json({
      site,
      from: from || null,
      to: to || null,
      count: entries.length,
      entries,
    })
  } catch (e) {
    console.error('fuelRec.list error:', e)
    return res.status(500).json({ error: 'Failed to list BOL photos' })
  }
})

// Bridge to Location model (CJS) and email service (CJS)
let _Location
async function getLocation() {
  if (_Location) return _Location
  const mod = await import('../models/Location.js')
  _Location = mod.default || mod.Location
  return _Location
}

let _sendEmail
async function getSendEmail() {
  if (_sendEmail) return _sendEmail
  const mod = await import('../utils/emailService.js')
  _sendEmail = mod.sendEmail || (mod.default && mod.default.sendEmail)
  return _sendEmail
}

// POST /api/fuel-rec/request-again
// body: { site: string, date: 'YYYY-MM-DD' }
router.post('/request-again', async (req, res) => {
  const site = String(req.body?.site || '').trim()
  const date = String(req.body?.date || '').trim()

  if (!site || !isYmd(date)) {
    return res.status(400).json({ error: 'site and date (YYYY-MM-DD) are required' })
  }

  try {
    const Location = await getLocation()
    const location = await Location.findOne(
      { stationName: site },
      { email: 1, stationName: 1 }
    ).lean()

    if (!location) {
      return res.status(404).json({ error: `Location not found for stationName '${site}'` })
    }

    const to = String(location.email || '').trim()
    if (!to) {
      return res.status(400).json({ error: 'Location has no email configured' })
    }

    // const sendEmail = await getSendEmail()
    // await sendEmail({
    //   to: 'mohammad@gen7fuel.com',
    //   subject: `BOL Photo Retake Requested – ${location.stationName} – ${date}`,
    //   text: `A new photo for the BOL was requested for the date of ${date}. Reason: Image not clear.`,
    // })
    // 1. Construct the redirect URL
    const redirectUrl = `https://app.gen7fuel.com/fuel-rec?site=${encodeURIComponent(location.stationName)}&date=${date}`;

    // 2. Define the Subject
    const subject = `📸 BOL Photo Retake Requested – ${location.stationName} – ${date}`;

    // 3. Define Plain Text version
    const text = `A photo retake for the Bill of Lading (BOL) has been requested for ${location.stationName} on ${date}. 
      Reason: Image not clear / Blur.
      Please re-upload here: ${redirectUrl}`;

    // 4. Define HTML version
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7f6; padding: 30px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
          
          <div style="background-color: #bd33fd; color: #ffffff; text-align: center; padding: 20px 0;">
            <h1 style="margin: 0; font-size: 22px;">📸 BOL Photo Retake Requested</h1>
          </div>

          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #444; line-height: 1.6;">
              A request has been made to <strong>retake and re-upload</strong> the Bill of Lading (BOL) document for the following delivery:
            </p>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #fdfdfd; border-radius: 8px;">
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #555; border-bottom: 1px solid #f0f0f0;">🏪 Station:</td>
                <td style="padding: 12px; color: #222; border-bottom: 1px solid #f0f0f0;">${location.stationName}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #555; border-bottom: 1px solid #f0f0f0;">📅 Delivery Date:</td>
                <td style="padding: 12px; color: #222; border-bottom: 1px solid #f0f0f0;">${date}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #d32f2f;">❓ Reason:</td>
                <td style="padding: 12px; color: #d32f2f; font-weight: 500;">Image not clear / Blur reported.</td>
              </tr>
            </table>

            <div style="
              margin-top: 24px;
              background-color: #f5ddfc;
              border-left: 6px solid #fa5df2;
              padding: 16px;
              border-radius: 8px;
            ">
              <p style="margin: 0; color: #c609ff; font-size: 15px;">
                Please ensure the new photo is well-lit and all text on the document is clearly legible before submitting.
              </p>
            </div>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${redirectUrl}" 
                style="background-color: #333333; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block; font-size: 16px;">
                📤 Re-upload BOL Document
              </a>
            </div>

            <p style="color: #888; font-size: 12px; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
              Gen7 Fuel Hub - Fuel Reconciliation System<br>
              <em>This is an automated request. Please use the link above to fulfill the request.</em>
            </p>
          </div>
        </div>
      </div>
      `;

    // 5. Add to Email Queue
    await emailQueue.add("sendBOLRequestEmail", {
      to,
      cc: ['daksh@gen7fuel.com', 'mohammad@gen7fuel.com'],
      subject,
      text,
      html
    });

    console.log(`📨 BOL Retake request queued for ${location.stationName}`);

    return res.status(200).json({ sent: true })
  } catch (e) {
    console.error('fuelRec.request-again error:', e)
    return res.status(500).json({ error: 'Failed to send retake request email' })
  }
})

// DELETE /api/fuel-rec/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim()
    if (!id) return res.status(400).json({ error: 'id is required' })

    const BOLPhoto = await getBOLPhoto()
    const deleted = await BOLPhoto.findByIdAndDelete(id).lean()
    if (!deleted) return res.status(404).json({ error: 'Entry not found' })

    return res.json({ deleted: true, id })
  } catch (e) {
    console.error('fuelRec.delete error:', e)
    return res.status(500).json({ error: 'Failed to delete BOL photo' })
  }
})

// POST /api/fuel-rec/:id/comment
router.post('/:id/comment', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim()
    const text = String(req.body?.text || '').trim()
    if (!id || !text) return res.status(400).json({ error: 'id and text are required' })

    // User info from auth middleware
    const user = (req.user && (req.user.name || req.user.email)) || 'Unknown'

    const BOLPhoto = await getBOLPhoto()
    const update = {
      $push: {
        comments: {
          text,
          createdAt: new Date(),
          user,
        },
      },
    }
    const updated = await BOLPhoto.findByIdAndUpdate(id, update, { new: true, lean: true })
    if (!updated) return res.status(404).json({ error: 'Entry not found' })
    return res.json({ ok: true, comments: updated.comments })
  } catch (e) {
    console.error('fuelRec.comment error:', e)
    return res.status(500).json({ error: 'Failed to add comment' })
  }
})

module.exports = router