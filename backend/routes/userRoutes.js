const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET route to fetch all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find(); // Fetch all users from the database
    res.status(200).json(users); // Send the users as a JSON response
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET route to fetch a single user by userId
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId); // Find user by ID
    if (!user) {
      return res.status(404).json({ error: 'User not found' }); // Return 404 if user doesn't exist
    }
    res.status(200).json(user); // Send the user as a JSON response
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT route to update the 'access' attribute of a user by _id
// router.put('/:userId', async (req, res) => {
//   const { userId } = req.params;
//   const { access } = req.body; // Extract the 'access' object from the request body

//   if (!access || typeof access !== 'object') {
//     return res.status(400).json({ error: 'Invalid or missing access object' });
//   }

//   try {
//     const updatedUser = await User.findByIdAndUpdate(
//       userId, // Find the user by _id
//       { $set: { access } }, // Update the 'access' attribute
//       { new: true } // Return the updated document
//     );

//     if (!updatedUser) {
//       return res.status(404).json({ error: 'User not found' }); // Return 404 if user doesn't exist
//     }

//     res.status(200).json(updatedUser); // Send the updated user as a JSON response
//   } catch (error) {
//     console.error('Error updating user access:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

router.put('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { access, is_admin, is_inOffice } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          access: access || {},
          is_admin: is_admin ?? false,
          is_inOffice: is_inOffice ?? false,
        },
      },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;