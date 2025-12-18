const React = require('react')
const { pdf, Document, Page, Image, StyleSheet, Text, View } = require('@react-pdf/renderer')
const path = require('path')
const { Lottery } = require('../models/Lottery')

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 10 },
  image: { marginBottom: 10, maxWidth: '100%', maxHeight: 400, objectFit: 'contain' },
  caption: { fontSize: 10, marginBottom: 6, textAlign: 'center' },
})

/**
 * Generate PDF from Lottery images for a given site/date.
 * @param {string} site
 * @param {string} date
 * @param {string} origin - full base URL (e.g., CDN_BASE_URL)
 * @returns {Buffer|null}
 */
async function generateLotteryImagesPdf({ site, date, origin }) {
  if (!site || !date) throw new Error('site and date are required')
  if (!origin) throw new Error('origin (base URL) is required')

  const lottery = await Lottery.findOne({ site, date }).lean()
  if (!lottery || !lottery.images || !lottery.images.length) return null

  const h = React.createElement

  // Map images to full URL
  const imageUrls = lottery.images.map((imgPath) => {
    const photoName = path.basename(String(imgPath))
    return `${origin.replace(/\/$/, '')}/cdn/download/${encodeURIComponent(photoName)}`
  })

  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(Text, { style: styles.title }, `Lottery Images – ${site} – ${date}`),
      ...imageUrls.map((url, idx) =>
        h(
          View,
          { key: idx },
          h(Image, { src: url, style: styles.image }),
          h(Text, { style: styles.caption }, `Image ${idx + 1}`)
        )
      )
    )
  )

  const instance = pdf(doc)
  return await instance.toBuffer()
}

module.exports = { generateLotteryImagesPdf }