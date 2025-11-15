const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  imageUrl: String,
  price: Number,
  location: {
    lat: Number,
    lng: Number
  },
  instagram: String,
  website: String,
  ticketLink: String,
  address: String,
  city: String,
  venueName: String,
  date: Date,
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value >= this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  ourRecommendation: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Event', EventSchema);
