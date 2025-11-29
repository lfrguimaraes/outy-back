const express = require('express');
const router = express.Router();
const { validateAppId } = require('../middleware/appIdMiddleware');
const { optionalAuth } = require('../middleware/authMiddleware');
const { analyticsRateLimiter } = require('../middleware/analyticsRateLimitMiddleware');
const AnalyticsEvent = require('../models/AnalyticsEvent');

// Valid event types whitelist
const VALID_EVENT_TYPES = [
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
];

/**
 * Validate a single event
 */
function validateEvent(event) {
  // Check required fields
  if (!event.event || !event.timestamp || !event.deviceId || !event.appVersion || !event.osVersion) {
    return { valid: false, error: 'Missing required fields' };
  }

  // Validate event type
  if (!VALID_EVENT_TYPES.includes(event.event)) {
    return { valid: false, error: `Invalid event type: ${event.event}` };
  }

  // Validate timestamp
  const timestamp = new Date(event.timestamp);
  if (isNaN(timestamp.getTime())) {
    return { valid: false, error: 'Invalid timestamp format' };
  }

  // Reject future dates (more than 5 minutes in the future to account for clock skew)
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  if (timestamp > fiveMinutesFromNow) {
    return { valid: false, error: 'Timestamp is too far in the future' };
  }

  // Reject very old dates (>1 year)
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  if (timestamp < oneYearAgo) {
    return { valid: false, error: 'Timestamp is too old' };
  }

  // Validate deviceId format (UUID or similar)
  if (typeof event.deviceId !== 'string' || event.deviceId.length < 10 || event.deviceId.length > 255) {
    return { valid: false, error: 'Invalid deviceId format' };
  }

  // Validate appVersion and osVersion
  if (typeof event.appVersion !== 'string' || event.appVersion.length > 20) {
    return { valid: false, error: 'Invalid appVersion format' };
  }
  if (typeof event.osVersion !== 'string' || event.osVersion.length > 20) {
    return { valid: false, error: 'Invalid osVersion format' };
  }

  // Validate userId if present
  if (event.userId !== null && event.userId !== undefined) {
    if (typeof event.userId !== 'string' || event.userId.length > 255) {
      return { valid: false, error: 'Invalid userId format' };
    }
  }

  // Sanitize string fields to prevent XSS
  const sanitizeString = (str, maxLength = 1000) => {
    if (!str || typeof str !== 'string') return null;
    return str.substring(0, maxLength).replace(/[<>]/g, '');
  };

  return { valid: true };
}

/**
 * Sanitize event data
 */
function sanitizeEvent(event) {
  const sanitizeString = (str, maxLength = 1000) => {
    if (!str || typeof str !== 'string') return null;
    return str.substring(0, maxLength).replace(/[<>]/g, '');
  };

  return {
    event: event.event,
    timestamp: new Date(event.timestamp),
    userId: event.userId || null,
    deviceId: event.deviceId,
    appVersion: event.appVersion,
    osVersion: event.osVersion,
    // Context fields
    screen: sanitizeString(event.context?.screen, 50),
    eventId: sanitizeString(event.context?.eventId, 255),
    eventName: sanitizeString(event.context?.eventName),
    city: sanitizeString(event.context?.city, 100),
    venueName: sanitizeString(event.context?.venueName),
    linkType: sanitizeString(event.context?.linkType, 50),
    searchQuery: sanitizeString(event.context?.searchQuery),
    filterType: sanitizeString(event.context?.filterType, 50),
    filterValue: sanitizeString(event.context?.filterValue)
  };
}

/**
 * POST /analytics/events
 * Receive and store analytics events in batches
 * 
 * Authentication: Optional (supports guest users)
 * Rate Limit: 100 events per minute per deviceId
 */
router.post('/events', validateAppId, optionalAuth, analyticsRateLimiter, async (req, res) => {
  try {
    // Validate request body is an array
    if (!Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Invalid request format. Expected an array of events.',
        code: 'INVALID_REQUEST_FORMAT'
      });
    }

    // Validate batch size
    if (req.body.length === 0) {
      return res.status(400).json({
        error: 'Empty event array',
        code: 'EMPTY_EVENT_ARRAY'
      });
    }

    if (req.body.length > 100) {
      return res.status(400).json({
        error: 'Batch size exceeds maximum of 100 events',
        code: 'BATCH_SIZE_EXCEEDED'
      });
    }

    // Validate and sanitize events
    const validEvents = [];
    const invalidEvents = [];

    for (let i = 0; i < req.body.length; i++) {
      const event = req.body[i];
      const validation = validateEvent(event);

      if (validation.valid) {
        // Override userId with authenticated user if present
        const sanitizedEvent = sanitizeEvent(event);
        if (req.user && req.user._id) {
          sanitizedEvent.userId = req.user._id.toString();
        }
        validEvents.push(sanitizedEvent);
      } else {
        invalidEvents.push({ index: i, error: validation.error });
        // Log invalid events for debugging
        console.warn(`Invalid analytics event at index ${i}:`, validation.error, event);
      }
    }

    // If no valid events, return error
    if (validEvents.length === 0) {
      return res.status(400).json({
        error: 'No valid events in batch',
        code: 'NO_VALID_EVENTS',
        invalidEvents: invalidEvents
      });
    }

    // Store events asynchronously (fire-and-forget)
    // Don't wait for database write to complete
    AnalyticsEvent.insertMany(validEvents, { ordered: false })
      .then(() => {
        console.log(`Successfully stored ${validEvents.length} analytics events`);
      })
      .catch((err) => {
        // Log error but don't fail the request
        console.error('Failed to store analytics events:', err);
        // Optionally, you could implement retry logic or queue system here
      });

    // Return success immediately
    res.status(200).json({
      success: true,
      eventsReceived: validEvents.length,
      eventsRejected: invalidEvents.length,
      ...(invalidEvents.length > 0 && { invalidEvents })
    });

  } catch (err) {
    // Catch any unexpected errors
    console.error('Unexpected error in analytics endpoint:', err);
    
    // Still return success to not break the app
    // But log the error for monitoring
    res.status(200).json({
      success: true,
      eventsReceived: 0,
      warning: 'Events may not have been stored due to server error'
    });
  }
});

module.exports = router;

