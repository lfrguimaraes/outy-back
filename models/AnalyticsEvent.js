const mongoose = require('mongoose');

const AnalyticsEventSchema = new mongoose.Schema({
  event: {
    type: String,
    required: true,
    enum: [
      'screen_view',
      'event_viewed',
      'event_clicked',
      'event_shared',
      'link_clicked',
      'website_clicked',
      'ticket_link_clicked',
      'instagram_clicked',
      'search_performed',
      'search_result_clicked',
      'filter_applied',
      'city_changed',
      'date_filter_changed',
      'login_attempted',
      'login_succeeded',
      'login_failed',
      'logout'
    ],
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  userId: {
    type: String,
    default: null,
    index: true
  },
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  appVersion: {
    type: String,
    required: true
  },
  osVersion: {
    type: String,
    required: true
  },
  // Context fields (denormalized for easier querying)
  screen: {
    type: String,
    default: null,
    index: true
  },
  eventId: {
    type: String,
    default: null,
    index: true
  },
  eventName: {
    type: String,
    default: null
  },
  city: {
    type: String,
    default: null,
    index: true
  },
  venueName: {
    type: String,
    default: null
  },
  linkType: {
    type: String,
    default: null
  },
  searchQuery: {
    type: String,
    default: null,
    index: true
  },
  filterType: {
    type: String,
    default: null
  },
  filterValue: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
AnalyticsEventSchema.index({ timestamp: 1, event: 1 });
AnalyticsEventSchema.index({ deviceId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ userId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ eventId: 1, timestamp: -1 });

// TTL index to automatically delete events after 90 days
AnalyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AnalyticsEvent', AnalyticsEventSchema);

