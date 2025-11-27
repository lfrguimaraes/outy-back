
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { validateAppId } = require('../middleware/appIdMiddleware');
const Ticket = require('../models/Ticket');
const cloudinary = require('../utils/cloudinary');

router.post('/upload', validateAppId, protect, async (req, res) => {
  const { image, eventId } = req.body;
  const upload = await cloudinary.uploader.upload(image, { folder: "tickets" });
  const ticket = await Ticket.create({
    userId: req.user._id,
    eventId,
    qrImageUrl: upload.secure_url
  });
  res.status(201).json(ticket);
});

router.get('/', validateAppId, protect, async (req, res) => {
  const tickets = await Ticket.find({ userId: req.user._id }).populate('eventId');
  res.json(tickets);
});

router.get('/:id', validateAppId, protect, async (req, res) => {
  const ticket = await Ticket.findById(req.params.id).populate('eventId');
  if (!ticket || ticket.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Unauthorized" });
  }
  res.json(ticket);
});

module.exports = router;
