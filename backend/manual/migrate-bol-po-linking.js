/**
 * Backfill the BOL/PO linking flags for records created before the linking
 * workflow was introduced.
 *
 * The supplied date is an exclusive cutoff for fuel orders. BOL photos use a
 * seven-day transition window:
 *   - photos before T-7 are marked linked automatically;
 *   - photos from T-7 through T are marked linked only when they have a
 *     "BOL Posted" comment.
 *
 * Dry run by default; pass --apply to write changes.
 *
 * Usage:
 *   node manual/migrate-bol-po-linking.js 2026-10-14
 *   node manual/migrate-bol-po-linking.js 2026-10-14 --apply
 */

require('dotenv').config()
const mongoose = require('mongoose')
const FuelOrder = require('../models/fuel/FuelOrder')
const BOLPhoto = require('../models/FuelRec')

const dateArg = process.argv[2]
const apply = process.argv.includes('--apply')

function parseDateArg(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    throw new Error('Date must be in YYYY-MM-DD format')
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}`)
  }

  return date
}

function subtractDays(date, days) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() - days)
  return result
}

function hasBolPostedComment(bol) {
  return (bol.comments || []).some((comment) =>
    String(comment.text || '').trim().toLowerCase() === 'bol posted'
  )
}

async function run() {
  const cutoff = parseDateArg(dateArg)
  const cutoffYmd = cutoff.toISOString().slice(0, 10)
  const bolTransitionDate = subtractDays(cutoff, 7)
  const bolTransitionYmd = bolTransitionDate.toISOString().slice(0, 10)

  await mongoose.connect(process.env.MONGO_URI)
  console.log(`Connected to MongoDB (${apply ? 'APPLY' : 'dry run'})`)
  console.log(`Fuel order cutoff: before ${cutoffYmd}`)
  console.log(`BOL transition date: ${bolTransitionYmd}`)

  const fuelOrderFilter = {
    originalDeliveryDate: { $lt: cutoff },
    currentStatus: 'Delivered',
    bolLinked: { $ne: true },
  }
  const fuelOrderCount = await FuelOrder.countDocuments(fuelOrderFilter)

  if (apply && fuelOrderCount > 0) {
    await FuelOrder.updateMany(fuelOrderFilter, { $set: { bolLinked: true } })
  }

  const automaticBolFilter = {
    date: { $lt: bolTransitionYmd },
    poLinked: { $ne: true },
  }
  const transitionBolFilter = {
    date: { $gte: bolTransitionYmd, $lte: cutoffYmd },
    poLinked: { $ne: true },
  }

  const automaticBolCount = await BOLPhoto.countDocuments(automaticBolFilter)
  const transitionBols = await BOLPhoto.find(transitionBolFilter)
    .select('comments')
    .lean()
  const transitionBolCount = transitionBols.filter(hasBolPostedComment).length
  const transitionBolSkipped = transitionBols.length - transitionBolCount

  if (apply && automaticBolCount > 0) {
    await BOLPhoto.updateMany(automaticBolFilter, { $set: { poLinked: true } })
  }

  if (apply && transitionBolCount > 0) {
    const transitionIds = transitionBols
      .filter(hasBolPostedComment)
      .map((bol) => bol._id)
    await BOLPhoto.updateMany(
      { _id: { $in: transitionIds }, poLinked: { $ne: true } },
      { $set: { poLinked: true } }
    )
  }

  console.log(`${apply ? 'Updated' : 'Would update'} ${fuelOrderCount} fuel orders (bolLinked=true)`)
  console.log(`${apply ? 'Updated' : 'Would update'} ${automaticBolCount} BOL photos before ${bolTransitionYmd} (poLinked=true)`)
  console.log(`${apply ? 'Updated' : 'Would update'} ${transitionBolCount} BOL photos from ${bolTransitionYmd} through ${cutoffYmd} with a BOL Posted comment`)
  console.log(`Skipped ${transitionBolSkipped} BOL photos from ${bolTransitionYmd} through ${cutoffYmd} without a BOL Posted comment`)
}

run()
  .catch((error) => {
    console.error('BOL/PO migration failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }
  })

