const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const Event = require('../models/Event');
const cloudinary = require('../utils/cloudinary');
const { geocodeAddress } = require('../utils/geocode');
const auth = require('../middleware/authMiddleware');
const axios = require('axios');

// Create a single event
router.post('/', protect, admin, async (req, res) => {
  try {
    const event = req.body;

    if (!event.address) {
      return res.status(400).json({ message: 'Address is required' });
    }

    const coords = await geocodeAddress(event.address);
    if (!coords) {
      return res.status(500).json({ message: 'Failed to geocode address' });
    }

    const newEvent = new Event({
      ...event,
      location: {
        lat: coords.lat,
        lng: coords.lng  // ✅ correct key
      }
    });

    const savedEvent = await newEvent.save();
    res.status(201).json(savedEvent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while creating event', error: err.message });
  }
});


// Bulk event creation (admin only)
router.post('/bulk', protect, admin, async (req, res) => {
  try {
    const inputEvents = req.body;

    if (!Array.isArray(inputEvents)) {
      return res.status(400).json({ message: "Payload must be an array of events" });
    }

    // Validate recurrence fields for each event
    for (const event of inputEvents) {
      if (event.recurrenceSeriesId) {
        if (!event.recurrencePattern) {
          return res.status(400).json({ 
            message: `recurrencePattern is required when recurrenceSeriesId is provided for event: ${event.name}` 
          });
        }
        if (!event.recurrenceDaysOfWeek || event.recurrenceDaysOfWeek.length === 0) {
          return res.status(400).json({ 
            message: `recurrenceDaysOfWeek is required when recurrenceSeriesId is provided for event: ${event.name}` 
          });
        }
        // Validate days of week are 0-6
        if (!event.recurrenceDaysOfWeek.every(day => Number.isInteger(day) && day >= 0 && day <= 6)) {
          return res.status(400).json({ 
            message: `recurrenceDaysOfWeek must contain numbers between 0-6 for event: ${event.name}` 
          });
        }
      }
    }

    const eventsWithGeo = await Promise.all(
      inputEvents.map(async (event) => {
        if (!event.address) {
          throw new Error(`Missing address for event: ${event.name}`);
        }

        const coords = await geocodeAddress(event.address);
        if (!coords) {
          throw new Error(`Failed to geocode address: ${event.address}`);
        }

        return {
          ...event,
          location: {
            lat: coords.lat,
            lng: coords.lng
          }
        };
      })
    );

    const savedEvents = await Event.insertMany(eventsWithGeo);
    res.status(201).json({ message: "Events created successfully", events: savedEvents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error while bulk creating events", error: err.message });
  }
});

// Get events with optional filters
router.get('/', async (req, res) => {
  const { city, date, id } = req.query;
  const filter = {};

  if (id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid event ID in query' });
    }
    filter._id = id;
  }

  if (city) filter.city = city;
  if (date) filter.date = { $gte: new Date(date) };

  try {
    const events = await Event.find(filter);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get a single event by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid event ID' });
  }

  try {
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update an event
router.put('/:id', protect, admin, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid event ID' });
  }

  try {
    const event = await Event.findByIdAndUpdate(id, req.body, { new: true });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete an event
router.delete('/:id', protect, admin, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid event ID' });
  }

  try {
    const event = await Event.findByIdAndDelete(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all events in a recurring series
router.get('/series/:seriesId', async (req, res) => {
  const { seriesId } = req.params;

  try {
    const events = await Event.find({ recurrenceSeriesId: seriesId }).sort({ startDate: 1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete all events in a recurring series
router.delete('/series/:seriesId', protect, admin, async (req, res) => {
  const { seriesId } = req.params;

  try {
    const result = await Event.deleteMany({ recurrenceSeriesId: seriesId });
    res.json({ 
      message: `Deleted ${result.deletedCount} event(s) from series`, 
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
