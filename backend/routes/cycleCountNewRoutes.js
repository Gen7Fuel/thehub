const express = require('express');
const router = express.Router();
const { Item } = require('../models/CycleCountNew');

// POST route to save processed items
router.post('/items/bulk-create', async (req, res) => {
  try {
    const { processedData } = req.body;

    if (!processedData || !Array.isArray(processedData)) {
      return res.status(400).json({ message: 'Invalid processed data' });
    }

    console.log(`📦 BACKEND: Received ${processedData.length} items to process`);

    // Transform processed data to match ItemSchema
    const itemsToSave = processedData.map(item => ({
      name: item.ItemName,
      gtin: item.ItemCode,
      sales: parseFloat(item.Sales) || 0,
      cumulative_sales: parseFloat(item['Cumulative Sales']) || 0,
      grade: item.Grade,
      categories: item.Category,
      site: item.Site ? item.Site.replace(/ Gen 7$/i, '') : '' // Remove " Gen 7" from the end
    }));

    console.log('🎯 Sample item to save:', itemsToSave[0]);

    // Use compound key (GTIN + Site) to handle duplicates
    const savedItems = [];
    const errors = [];

    for (const itemData of itemsToSave) {
      try {
        const savedItem = await Item.findOneAndUpdate(
          { 
            gtin: itemData.gtin,
            site: itemData.site  // Use both GTIN and Site as compound key
          },
          itemData, // Update with new data
          { 
            upsert: true, // Create if doesn't exist
            new: true, // Return updated document
            runValidators: true // Run schema validation
          }
        );
        savedItems.push(savedItem);
        console.log(`✅ Saved/Updated item: ${savedItem.name} (${savedItem.gtin}) at ${savedItem.site}`);
      } catch (error) {
        console.error(`❌ Error saving item ${itemData.name} at ${itemData.site}:`, error.message);
        errors.push({ item: itemData.name, site: itemData.site, error: error.message });
      }
    }

    console.log(`🎉 BULK SAVE COMPLETE: ${savedItems.length} items saved, ${errors.length} errors`);

    res.status(201).json({
      message: 'Items processed successfully',
      saved: savedItems.length,
      errors: errors.length,
      errorDetails: errors,
      items: savedItems
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR in bulk item save:', error);
    res.status(500).json({ 
      message: 'Failed to save items', 
      error: error.message 
    });
  }
});

// // Add this route to create cycles
// router.post('/cycles/create', async (req, res) => {
//   try {
//     const { site } = req.body;

//     if (!site) {
//       return res.status(400).json({ message: 'Site is required' });
//     }

//     console.log(`🔄 Creating cycle for site: ${site}`);

//     // Get all items for this site, sorted by grade (A, B, C) then by categories descending
//     const items = await Item.find({ site })
//       .sort({ 
//         grade: 1, // A comes before B comes before C
//         categories: 1  // Within each grade, sort by categories
//       });

//     if (items.length === 0) {
//       return res.status(400).json({ message: `No items found for site: ${site}` });
//     }

//     console.log(`📦 Found ${items.length} items for site ${site}`);

//     // Calculate cycle dates
//     const today = new Date();
//     const nextMonday = getNextMonday(today);
    
//     const ITEMS_PER_DAY = 30;
//     const DAYS_PER_WEEK = 5; // Monday to Friday
//     const totalDaysNeeded = Math.ceil(items.length / ITEMS_PER_DAY);
//     const totalWeeksNeeded = Math.ceil(totalDaysNeeded / DAYS_PER_WEEK);
    
//     // Calculate end date (last Friday of the cycle)
//     const endDate = new Date(nextMonday);
//     endDate.setDate(nextMonday.getDate() + (totalWeeksNeeded * 7) - 3); // -3 to get Friday

//     console.log(`📅 Cycle: ${nextMonday.toDateString()} to ${endDate.toDateString()}`);
//     console.log(`📊 Total days needed: ${totalDaysNeeded}, Total weeks: ${totalWeeksNeeded}`);

//     // Create the cycle
//     const cycle = new Cycle({
//       start_date: nextMonday,
//       end_date: endDate,
//       site: site,
//       completed: false
//     });

//     const savedCycle = await cycle.save();
//     console.log(`✅ Created cycle with ID: ${savedCycle._id}`);

//     // Create count records for each item
//     const countRecords = items.map(item => ({
//       gtin: item.gtin,
//       cycle: savedCycle._id,
//       counted: false,
//       flagged: false
//     }));

//     const savedCounts = await Count.insertMany(countRecords);
//     console.log(`✅ Created ${savedCounts.length} count records`);

//     res.status(201).json({
//       message: 'Cycle created successfully',
//       cycle: savedCycle,
//       itemsCount: items.length,
//       countsCreated: savedCounts.length,
//       schedule: {
//         startDate: nextMonday,
//         endDate: endDate,
//         totalDays: totalDaysNeeded,
//         totalWeeks: totalWeeksNeeded,
//         itemsPerDay: ITEMS_PER_DAY
//       }
//     });

//   } catch (error) {
//     console.error('❌ Error creating cycle:', error);
//     res.status(500).json({ 
//       message: 'Failed to create cycle', 
//       error: error.message 
//     });
//   }
// });

// // Helper function to get next Monday
// function getNextMonday(date) {
//   const result = new Date(date);
//   const dayOfWeek = result.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
//   if (dayOfWeek === 0) {
//     // If today is Sunday, next Monday is tomorrow
//     result.setDate(result.getDate() + 1);
//   } else if (dayOfWeek === 1) {
//     // If today is Monday, next Monday is in 7 days
//     result.setDate(result.getDate() + 7);
//   } else {
//     // For Tuesday-Saturday, calculate days until next Monday
//     const daysUntilMonday = 8 - dayOfWeek; // 8 - 2 = 6 (Tue->Mon), 8 - 6 = 2 (Sat->Mon)
//     result.setDate(result.getDate() + daysUntilMonday);
//   }
  
//   // Set to start of day (midnight)
//   result.setHours(0, 0, 0, 0);
//   return result;
// }

module.exports = router;