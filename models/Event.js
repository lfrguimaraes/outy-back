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
  },
  music: {
    type: [String],
    enum: ['Pop', 'House', 'Techno', 'Afro', 'Hip Hop', 'Trance', 'Latino', 'Brazilian', 'Rock', 'Reggae'],
    default: []
  },
  type: {
    type: String,
    enum: ['Bar', 'Club', 'Concert', 'Cinema', 'Underground', 'Warehouse', 'Theater', 'Boat', 'Cruising', 'Sauna']
  },
  // Recurrence fields
  recurrenceSeriesId: {
    type: String,
    required: false,
    index: true
  },
  recurrencePattern: {
    type: String,
    enum: ['weekly'],
    required: false
  },
  recurrenceDaysOfWeek: {
    type: [Number],
    required: false,
    validate: {
      validator: function(value) {
        if (!value || value.length === 0) return true;
        return value.every(day => Number.isInteger(day) && day >= 0 && day <= 6);
      },
      message: 'recurrenceDaysOfWeek must be an array of numbers between 0-6 (Sunday-Saturday)'
    }
  },
  recurrenceEndDate: {
    type: Date,
    required: false
  },
  isRecurringInstance: {
    type: Boolean,
    default: false
  }
});

// Custom validation: if recurrenceSeriesId is provided, recurrencePattern and recurrenceDaysOfWeek should also be provided
EventSchema.pre('validate', function(next) {
  if (this.recurrenceSeriesId) {
    if (!this.recurrencePattern) {
      this.invalidate('recurrencePattern', 'recurrencePattern is required when recurrenceSeriesId is provided');
    }
    if (!this.recurrenceDaysOfWeek || this.recurrenceDaysOfWeek.length === 0) {
      this.invalidate('recurrenceDaysOfWeek', 'recurrenceDaysOfWeek is required when recurrenceSeriesId is provided');
    }
  }
  
  // Validate recurrenceEndDate is in the future when creating recurring events
  if (this.recurrenceEndDate && this.isNew && this.recurrenceEndDate <= new Date()) {
    this.invalidate('recurrenceEndDate', 'recurrenceEndDate must be in the future when creating recurring events');
  }
  
  next();
});

module.exports = mongoose.model('Event', EventSchema);
