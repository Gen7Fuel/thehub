const express = require('express');
const router = express.Router();
const CycleCount = require('../models/CycleCount');

// Create cycle count entries from processed Excel data
router.post('/from-processed-data', async (req, res) => {
  try {
    console.log('🔄 BACKEND: /from-processed-data endpoint hit');
    const { processedData } = req.body;
    
    console.log('📦 Received data:', {
      hasProcessedData: !!processedData,
      isArray: Array.isArray(processedData),
      length: processedData?.length
    });
    
    if (!processedData || !Array.isArray(processedData)) {
      console.log('❌ Invalid data format, returning 400');
      return res.status(400).json({ message: 'Invalid processed data format' });
    }

    // Group by site
    const siteMap = {};
    processedData.forEach(item => {
      if (!siteMap[item.Site]) siteMap[item.Site] = [];
      siteMap[item.Site].push(item);
    });

    console.log('🏢 Site grouping complete:', Object.keys(siteMap));

    const createdEntries = [];

    console.log('⚡ Starting Promise.all for site processing...');
    await Promise.all(
      Object.entries(siteMap).map(async ([siteName, items]) => {
        console.log(`📍 Processing site: ${siteName} with ${items.length} items`);
        
        // Order by grade, then category (preserving order)
        const grades = ['A', 'B', 'C'];
        let ordered = [];
        grades.forEach(grade => {
          const gradeItems = items.filter(i => i.Grade === grade);
          const categoryMap = {};
          gradeItems.forEach(item => {
            if (!categoryMap[item.Category]) categoryMap[item.Category] = [];
            categoryMap[item.Category].push(item);
          });
          Object.values(categoryMap).forEach(categoryItems => {
            ordered.push(...categoryItems);
          });
        });

        console.log(`📋 Ordered items for ${siteName}: ${ordered.length}`);

        // Split into weeks and days (30 items per day, 5 days per week)
        const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const ITEMS_PER_DAY = 30;
        const DAYS_PER_WEEK = DAYS.length;
        const ITEMS_PER_WEEK = ITEMS_PER_DAY * DAYS_PER_WEEK;

        const totalWeeks = Math.ceil(ordered.length / ITEMS_PER_WEEK);
        console.log(`📅 ${siteName} will need ${totalWeeks} weeks`);

        // For each week, create entries for each day
        for (let week = 0; week < totalWeeks; week++) {
          for (let day = 0; day < DAYS_PER_WEEK; day++) {
            const startIdx = week * ITEMS_PER_WEEK + day * ITEMS_PER_DAY;
            const endIdx = startIdx + ITEMS_PER_DAY;
            const dayItems = ordered.slice(startIdx, endIdx);

            if (dayItems.length === 0) continue; // Skip empty days

            console.log(`📆 Creating entry: ${siteName} - Week ${week + 1}, ${DAYS[day]} (${dayItems.length} items)`);

            // Group items by category for this day and transform in one step
            const categoriesMap = {};
            dayItems.forEach(item => {
              if (!categoriesMap[item.Category]) {
                categoriesMap[item.Category] = [];
              }
              categoriesMap[item.Category].push({
                itemName: item.ItemName,
                itemCode: item.ItemCode || '',
                sales: item.Sales || 0, // Keep for grading, hidden from UI
                grade: item.Grade,
                counted: false // Initially, no items are counted
              });
            });

            // Convert to categories array (final format for database)
            const categories = Object.entries(categoriesMap).map(([name, items]) => ({
              name,
              items
            }));

            // Calculate assigned date (start date + week*7 + day)
            const baseDate = new Date();
            const assignedDate = new Date(baseDate);
            assignedDate.setDate(baseDate.getDate() + (week * 7) + day);

            // Create cycle count entry
            const cycleCountEntry = new CycleCount({
              site: siteName,
              categories,
              assignedDate,
              week: week + 1,
              dayOfWeek: DAYS[day],
              dayNumber: (week * DAYS_PER_WEEK) + day + 1,
              itemCount: dayItems.length,
              completed: false
            });

            console.log(`💾 About to save entry:`, {
              site: cycleCountEntry.site,
              week: cycleCountEntry.week,
              day: cycleCountEntry.dayOfWeek,
              itemCount: cycleCountEntry.itemCount,
              categoriesCount: categories.length
            });

            try {
              const savedEntry = await cycleCountEntry.save();
              console.log(`✅ Successfully saved entry with ID: ${savedEntry._id}`);
              createdEntries.push(savedEntry);
            } catch (saveError) {
              console.error(`❌ Failed to save entry for ${siteName} - Week ${week + 1}, ${DAYS[day]}:`, saveError);
              throw saveError; // Re-throw to be caught by outer try-catch
            }
          }
        }
      })
    );

    console.log(`🎉 All sites processed! Created ${createdEntries.length} entries total`);

    res.status(201).json({ 
      message: 'Cycle count entries created successfully',
      count: createdEntries.length,
      entries: createdEntries 
    });
  } catch (error) {
    console.error('❌ CRITICAL ERROR in /from-processed-data:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.stack) console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Failed to create cycle count entries', error: error.message });
  }
});

// Get all unique sites
router.get('/sites', async (req, res) => {
  try {
    const sites = await CycleCount.distinct('site');
    res.json({ sites: sites.sort() });
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ message: 'Failed to fetch sites' });
  }
});

// Create cycle count entries
router.post('/', async (req, res) => {
  try {
    const { cycleCountData, submittedBy } = req.body;

    if (!cycleCountData || !Array.isArray(cycleCountData)) {
      return res.status(400).json({ message: 'Invalid cycle count data' });
    }

    const savedCycleCounts = [];

    for (const data of cycleCountData) {
      const cycleCount = new CycleCount({
        site: data.site,
        assignedDate: new Date(data.assignedDate),
        week: data.week,
        dayOfWeek: data.dayOfWeek,
        dayNumber: data.dayNumber,
        itemCount: data.itemCount,
        categories: data.categories,
        completed: data.completed || false,
        submittedBy: submittedBy
      });

      const saved = await cycleCount.save();
      savedCycleCounts.push(saved);
    }

    res.status(201).json({
      message: 'Cycle count entries created successfully',
      cycleCounts: savedCycleCounts,
      count: savedCycleCounts.length
    });
  } catch (error) {
    console.error('Error creating cycle count entries:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get cycle count entries with filtering
router.get('/', async (req, res) => {
  try {
    const { site, completed, week, dayOfWeek, page = 1, limit = 20 } = req.query;
    const filter = {};
    
    if (site) filter.site = site;
    if (completed !== undefined) filter.completed = completed === 'true';
    if (week) filter.week = parseInt(week);
    if (dayOfWeek) filter.dayOfWeek = dayOfWeek;

    console.log('🔍 GET /api/cycle-counts - Filter:', filter);
    console.log('📄 Pagination:', { page, limit });

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const total = await CycleCount.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    // Get paginated results
    const cycleCounts = await CycleCount.find(filter)
      .sort({ site: 1, week: 1, dayNumber: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    console.log(`📦 Found ${cycleCounts.length} entries (total: ${total})`);

    // Return in expected format
    res.json({
      entries: cycleCounts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('❌ Error fetching cycle count entries:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get specific cycle count entry
router.get('/:id', async (req, res) => {
  try {
    const cycleCount = await CycleCount.findById(req.params.id);
    if (!cycleCount) {
      return res.status(404).json({ message: 'Cycle count entry not found' });
    }
    res.json(cycleCount);
  } catch (error) {
    console.error('Error fetching cycle count entry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update cycle count entry (for submitting counts)
router.put('/:id', async (req, res) => {
  try {
    const { categories, completed, submittedBy } = req.body;
    
    const updateData = {};
    if (categories) updateData.categories = categories;
    if (completed !== undefined) {
      updateData.completed = completed;
      if (completed && !req.body.submissionDate) {
        updateData.submissionDate = new Date();
      }
    }
    if (submittedBy) updateData.submittedBy = submittedBy;

    const updatedCycleCount = await CycleCount.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedCycleCount) {
      return res.status(404).json({ message: 'Cycle count entry not found' });
    }

    res.json(updatedCycleCount);
  } catch (error) {
    console.error('Error updating cycle count entry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update counted status for specific items
router.put('/:id/items', async (req, res) => {
  try {
    const { itemUpdates } = req.body; // Array of { categoryName, itemName, counted }
    
    const cycleCount = await CycleCount.findById(req.params.id);
    if (!cycleCount) {
      return res.status(404).json({ message: 'Cycle count entry not found' });
    }

    // Update counted status for specific items
    itemUpdates.forEach(update => {
      const category = cycleCount.categories.find(cat => cat.name === update.categoryName);
      if (category) {
        const item = category.items.find(item => item.itemName === update.itemName);
        if (item) {
          if (update.counted !== undefined) item.counted = update.counted;
        }
      }
    });

    const updatedCycleCount = await cycleCount.save();
    res.json(updatedCycleCount);
  } catch (error) {
    console.error('Error updating item counted status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete cycle count entry
router.delete('/:id', async (req, res) => {
  try {
    const deletedCycleCount = await CycleCount.findByIdAndDelete(req.params.id);
    if (!deletedCycleCount) {
      return res.status(404).json({ message: 'Cycle count entry not found' });
    }
    res.json({ message: 'Cycle count entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting cycle count entry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get cycle count statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { site } = req.query;
    const filter = {};
    if (site) filter.site = site;

    const stats = await CycleCount.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$site',
          totalEntries: { $sum: 1 },
          completedEntries: {
            $sum: { $cond: ['$completed', 1, 0] }
          },
          totalItems: { $sum: '$itemCount' },
          weeks: { $addToSet: '$week' }
        }
      },
      {
        $project: {
          site: '$_id',
          totalEntries: 1,
          completedEntries: 1,
          pendingEntries: { $subtract: ['$totalEntries', '$completedEntries'] },
          totalItems: 1,
          totalWeeks: { $size: '$weeks' },
          completionRate: {
            $multiply: [
              { $divide: ['$completedEntries', '$totalEntries'] },
              100
            ]
          }
        }
      }
    ]);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching cycle count statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;