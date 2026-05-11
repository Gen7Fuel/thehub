const express = require('express');
const PayPoint = require('../models/PayPoint');
const axios = require('axios'); // For making HTTP requests
const router = express.Router();

// Create a PayPoint
router.post('/:site', async (req, res) => {
  try {
    const { site } = req.params; // Slug from the URL
    const { name } = req.body; // PayPoint name from user input

    if (!name) {
      return res.status(400).json({ error: 'PayPoint name is required' });
    }

    // Convert slug back to stationName and capitalize words
    const stationName = site
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Fetch the location ID using the stationName
    let response;
    try {
      const url = `http://localhost:5000/api/locations?stationName=${encodeURIComponent(stationName)}`;
      console.log('Generated URL:', url); // Log the generated URL
      response = await axios.get(url);
    } catch (error) {
      console.error('Error fetching location:', error.message); // Log the error message
      if (error.response) {
        console.error('Error response data:', error.response.data); // Log the response data from the error
        console.error('Error response status:', error.response.status); // Log the HTTP status code
      }
      return res.status(500).json({ error: 'Failed to fetch location data' });
    }

    const location = response.data;
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Create the PayPoint entry
    const payPoint = new PayPoint({
      label: name,
      location: location._id,
    });

    await payPoint.save();
    res.status(201).json(payPoint);
  } catch (error) {
    console.error('Error creating PayPoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Read PayPoints for a specific station
router.get('/:site', async (req, res) => {
  try {
    const { site } = req.params; // Slug from the URL

    // Convert slug back to stationName and capitalize words
    const stationName = site
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    

    // Fetch the location ID using the stationName
    let response;
    try {
      const url = `http://localhost:5000/api/locations?stationName=${encodeURIComponent(stationName)}`;
      console.log('Generated URL:', url); // Log the generated URL
      response = await axios.get(url);
    } catch (error) {
      console.error('Error fetching location:', error.message); // Log the error message
      if (error.response) {
        console.error('Error response data:', error.response.data); // Log the response data from the error
        console.error('Error response status:', error.response.status); // Log the HTTP status code
      }
      return res.status(500).json({ error: 'Failed to fetch location data' });
    }

    const location = response.data;
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // // Fetch PayPoints for the specific location
    const payPoints = await PayPoint.find({ location: location._id }).populate('location', 'stationName');
    res.status(200).json(payPoints);
  } catch (error) {
    console.error('Error fetching PayPoints:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a PayPoint
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const payPoint = await PayPoint.findByIdAndDelete(id);
    if (!payPoint) {
      return res.status(404).json({ error: 'PayPoint not found' });
    }

    res.status(200).json({ message: 'PayPoint deleted successfully' });
  } catch (error) {
    console.error('Error deleting PayPoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;