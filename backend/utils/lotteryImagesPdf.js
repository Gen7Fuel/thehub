// const React = require('react')
// const { pdf, Document, Page, Image, StyleSheet, Text, View } = require('@react-pdf/renderer')
// const path = require('path')
// const { Lottery } = require('../models/Lottery')

// const styles = StyleSheet.create({
//   page: { padding: 24, fontSize: 10, fontFamily: 'Helvetica' },
//   title: { fontSize: 14, fontWeight: 700, marginBottom: 10 },
//   image: { marginBottom: 10, maxWidth: '100%', maxHeight: 400, objectFit: 'contain' },
//   caption: { fontSize: 10, marginBottom: 6, textAlign: 'center' },
// })

// /**
//  * Generate PDF from Lottery images for a given site/date.
//  * @param {string} site
//  * @param {string} date
//  * @param {string} origin - full base URL (e.g., CDN_BASE_URL)
//  * @returns {Buffer|null}
//  */
// async function generateLotteryImagesPdf({ site, date, origin }) {
//   if (!site || !date) throw new Error('site and date are required')
//   if (!origin) throw new Error('origin (base URL) is required')

//   const lottery = await Lottery.findOne({ site, date }).lean()
//   if (!lottery || !lottery.images || !lottery.images.length) return null

//   const h = React.createElement

//   // Map images to full URL
//   const imageUrls = lottery.images.map((imgPath) => {
//     const photoName = path.basename(String(imgPath))
//     return `${origin.replace(/\/$/, '')}/cdn/download/${encodeURIComponent(photoName)}`
//   })

//   const doc = h(
//     Document,
//     null,
//     h(
//       Page,
//       { size: 'A4', style: styles.page },
//       h(Text, { style: styles.title }, `Lottery Images – ${site} – ${date}`),
//       ...imageUrls.map((url, idx) =>
//         h(
//           View,
//           { key: idx },
//           h(Image, { src: url, style: styles.image }),
//           h(Text, { style: styles.caption }, `Image ${idx + 1}`)
//         )
//       )
//     )
//   )

//   const instance = pdf(doc)
//   return await instance.toBuffer()
// }

// module.exports = { generateLotteryImagesPdf }

const React = require('react')
const { pdf, Document, Page, Image, StyleSheet, Text, View } = require('@react-pdf/renderer')
const path = require('path')
const { Lottery } = require('../models/Lottery')

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: 'Helvetica' },
  mainTitle: { fontSize: 16, fontWeight: 700, marginBottom: 15, textAlign: 'center' },
  sectionHeader: { 
    fontSize: 14, 
    fontWeight: 700, 
    marginTop: 20, 
    marginBottom: 10, 
    paddingBottom: 4, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb' 
  },
  imageContainer: { marginBottom: 15, break: 'inside' },
  image: { marginBottom: 6, maxWidth: '100%', maxHeight: 400, objectFit: 'contain' },
  caption: { fontSize: 9, color: '#6b7280', textAlign: 'center', marginBottom: 10 },
})

/**
 * Generate PDF from Lottery and Datawave images for a given site/date.
 */
async function generateLotteryImagesPdf({ site, date, origin }) {
  if (!site || !date) throw new Error('site and date are required')
  if (!origin) throw new Error('origin (base URL) is required')

  const lottery = await Lottery.findOne({ site, date }).lean()
  
  // If no document exists or both image arrays are empty, return null
  const hasLottery = lottery?.images && lottery.images.length > 0
  const hasDatawave = lottery?.datawaveImages && lottery.datawaveImages.length > 0
  
  if (!lottery || (!hasLottery && !hasDatawave)) return null

  const h = React.createElement
  const baseUrl = origin.replace(/\/$/, '')

  // Helper to map paths to URLs
  const mapToUrl = (imgPath) => {
    const photoName = path.basename(String(imgPath))
    return `${baseUrl}/cdn/download/${encodeURIComponent(photoName)}`
  }

  const lotteryUrls = (lottery.images || []).map(mapToUrl)
  const datawaveUrls = (lottery.datawaveImages || []).map(mapToUrl)

  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(Text, { style: styles.mainTitle }, `Daily Reports – ${site} – ${date}`),

      // --- LOTTERY SECTION ---
      hasLottery && h(
        View,
        null,
        h(Text, { style: styles.sectionHeader }, 'Lottery Report'),
        ...lotteryUrls.map((url, idx) =>
          h(
            View,
            { key: `lotto-${idx}`, style: styles.imageContainer },
            h(Image, { src: url, style: styles.image }),
            h(Text, { style: styles.caption }, `Lottery Slip ${idx + 1}`)
          )
        )
      ),

      // --- DATAWAVE SECTION ---
      hasDatawave && h(
        View,
        null,
        h(Text, { style: styles.sectionHeader }, 'Datawave Report'),
        ...datawaveUrls.map((url, idx) =>
          h(
            View,
            { key: `dw-${idx}`, style: styles.imageContainer },
            h(Image, { src: url, style: styles.image }),
            h(Text, { style: styles.caption }, `Datawave Slip ${idx + 1}`)
          )
        )
      )
    )
  )

  const instance = pdf(doc)
  return await instance.toBuffer()
}

module.exports = { generateLotteryImagesPdf }