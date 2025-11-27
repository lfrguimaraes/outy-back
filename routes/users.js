const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { validateAppId } = require('../middleware/appIdMiddleware');
const User = require('../models/User');
const cloudinary = require('../utils/cloudinary');

router.get('/me', validateAppId, protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    preferredCity: user.preferredCity,
    isAdmin: user.role === 'admin' // ✅ Key field
  });
});

router.put('/me', validateAppId, protect, async (req, res) => {
  const { name, age, sexualPosition, tribe, preferredCity } = req.body;
  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { name, age, sexualPosition, tribe, preferredCity },
    { new: true }
  );
  res.json(updated);
});

router.post('/profile-image', validateAppId, protect, async (req, res) => {
  const { image } = req.body;
  const upload = await cloudinary.uploader.upload(image, { folder: "profiles" });
  req.user.profileImageUrl = upload.secure_url;
  await req.user.save();
  res.json({ url: upload.secure_url });
});

// Get all users (admin only)
router.get('/', validateAppId, protect, async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Exclude password
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
