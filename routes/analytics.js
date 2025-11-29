const express = require('express');
const router = express.Router();
const { validateAppId } = require('../middleware/appIdMiddleware');
const { optionalAuth, protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
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

/**
 * Helper function to build date filter for MongoDB queries
 */
function buildDateFilter(startDate, endDate) {
  const filter = {};
  
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filter.timestamp.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.timestamp.$lte = end;
    }
  } else {
    // Default to last 30 days if no dates provided
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    filter.timestamp = { $gte: thirtyDaysAgo };
  }
  
  return filter;
}

/**
 * GET /api/analytics/search
 * Get search analytics
 */
router.get('/search', validateAppId, protect, admin, async (req, res) => {
  try {
    const { startDate, endDate, limit = 50 } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);
    
    // Get search queries with counts
    const searchQueries = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'search_performed', searchQuery: { $ne: null } } },
      {
        $group: {
          _id: '$searchQuery',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          query: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Get result clicks for each search query
    const resultClicks = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'search_result_clicked', searchQuery: { $ne: null } } },
      {
        $group: {
          _id: '$searchQuery',
          count: { $sum: 1 }
        }
      }
    ]);

    const clicksMap = {};
    resultClicks.forEach(item => {
      clicksMap[item._id] = item.count;
    });

    // Add result clicks to queries
    const queriesWithClicks = searchQueries.map(q => ({
      ...q,
      resultClicks: clicksMap[q.query] || 0
    }));

    // Calculate success rate (searches that led to result clicks)
    const totalSearches = searchQueries.reduce((sum, q) => sum + q.count, 0);
    const totalClicks = resultClicks.reduce((sum, q) => sum + q.count, 0);
    const successRate = totalSearches > 0 ? (totalClicks / totalSearches) * 100 : 0;
    const conversionRate = totalSearches > 0 ? (totalClicks / totalSearches) * 100 : 0;

    // Get daily trends
    const trends = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'search_performed' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      queries: queriesWithClicks,
      successRate: parseFloat(successRate.toFixed(1)),
      conversionRate: parseFloat(conversionRate.toFixed(1)),
      trends
    });
  } catch (err) {
    console.error('Error fetching search analytics:', err);
    res.status(500).json({ error: 'Failed to fetch search analytics' });
  }
});

/**
 * GET /api/analytics/events/performance
 * Get event performance metrics
 */
router.get('/events/performance', validateAppId, protect, admin, async (req, res) => {
  try {
    const { eventId, startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);
    
    if (eventId) {
      dateFilter.eventId = eventId;
    }

    // Most viewed events
    const mostViewed = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'event_viewed', eventId: { $ne: null } } },
      {
        $group: {
          _id: '$eventId',
          eventName: { $first: '$eventName' },
          views: { $sum: 1 }
        }
      },
      { $sort: { views: -1 } },
      { $limit: 20 },
      {
        $project: {
          eventId: '$_id',
          eventName: 1,
          views: 1,
          _id: 0
        }
      }
    ]);

    // Most clicked events
    const mostClicked = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'event_clicked', eventId: { $ne: null } } },
      {
        $group: {
          _id: '$eventId',
          eventName: { $first: '$eventName' },
          clicks: { $sum: 1 }
        }
      },
      { $sort: { clicks: -1 } },
      { $limit: 20 },
      {
        $project: {
          eventId: '$_id',
          eventName: 1,
          clicks: 1,
          _id: 0
        }
      }
    ]);

    // Most shared events
    const mostShared = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'event_shared', eventId: { $ne: null } } },
      {
        $group: {
          _id: '$eventId',
          eventName: { $first: '$eventName' },
          shares: { $sum: 1 }
        }
      },
      { $sort: { shares: -1 } },
      { $limit: 20 },
      {
        $project: {
          eventId: '$_id',
          eventName: 1,
          shares: 1,
          _id: 0
        }
      }
    ]);

    // CTR data (click-through rate)
    const ctrData = await AnalyticsEvent.aggregate([
      {
        $facet: {
          views: [
            { $match: { ...dateFilter, event: 'event_viewed', eventId: { $ne: null } } },
            {
              $group: {
                _id: '$eventId',
                views: { $sum: 1 }
              }
            }
          ],
          clicks: [
            { $match: { ...dateFilter, event: 'event_clicked', eventId: { $ne: null } } },
            {
              $group: {
                _id: '$eventId',
                clicks: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    const viewsMap = {};
    const clicksMap = {};
    
    ctrData[0].views.forEach(v => { viewsMap[v._id] = v.views; });
    ctrData[0].clicks.forEach(c => { clicksMap[c._id] = c.clicks; });

    const ctr = Object.keys(viewsMap).map(id => ({
      eventId: id,
      views: viewsMap[id],
      clicks: clicksMap[id] || 0,
      ctr: viewsMap[id] > 0 ? ((clicksMap[id] || 0) / viewsMap[id] * 100).toFixed(2) : 0
    })).sort((a, b) => b.ctr - a.ctr).slice(0, 20);

    res.json({
      mostViewed,
      mostClicked,
      mostShared,
      ctrData: ctr
    });
  } catch (err) {
    console.error('Error fetching event performance:', err);
    res.status(500).json({ error: 'Failed to fetch event performance' });
  }
});

/**
 * GET /api/analytics/events/popular
 * Get popular events
 */
router.get('/events/popular', validateAppId, protect, admin, async (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // Get views and clicks separately, then merge
    const viewsData = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'event_viewed', eventId: { $ne: null } } },
      {
        $group: {
          _id: '$eventId',
          eventName: { $first: '$eventName' },
          views: { $sum: 1 }
        }
      }
    ]);

    const clicksData = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'event_clicked', eventId: { $ne: null } } },
      {
        $group: {
          _id: '$eventId',
          clicks: { $sum: 1 }
        }
      }
    ]);

    // Create maps for quick lookup
    const clicksMap = {};
    clicksData.forEach(item => {
      clicksMap[item._id] = item.clicks;
    });

    // Merge views and clicks
    const popularEvents = viewsData.map(item => ({
      eventId: item._id,
      eventName: item.eventName,
      views: item.views,
      clicks: clicksMap[item._id] || 0,
      count: item.views
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, parseInt(limit));

    res.json(popularEvents);
  } catch (err) {
    console.error('Error fetching popular events:', err);
    res.status(500).json({ error: 'Failed to fetch popular events' });
  }
});

/**
 * GET /api/analytics/users/engagement
 * Get user engagement metrics
 */
router.get('/users/engagement', validateAppId, protect, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // Active users (unique users/devices)
    const activeUsers = await AnalyticsEvent.distinct('userId', {
      ...dateFilter,
      userId: { $ne: null }
    });

    const activeDevices = await AnalyticsEvent.distinct('deviceId', dateFilter);
    const totalActiveUsers = Math.max(activeUsers.length, activeDevices.length);

    // Power users (users with many events)
    const userEventCounts = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, userId: { $ne: null } } },
      {
        $group: {
          _id: '$userId',
          eventCount: { $sum: 1 }
        }
      }
    ]);

    const powerUsers = userEventCounts.filter(u => u.eventCount >= 20).length;
    const casualUsers = userEventCounts.filter(u => u.eventCount < 20).length;

    // Average events per session (approximate using deviceId)
    const deviceStats = await AnalyticsEvent.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$deviceId',
          eventCount: { $sum: 1 },
          searchCount: {
            $sum: { $cond: [{ $eq: ['$event', 'search_performed'] }, 1, 0] }
          }
        }
      }
    ]);

    const avgEventsPerSession = deviceStats.length > 0
      ? deviceStats.reduce((sum, d) => sum + d.eventCount, 0) / deviceStats.length
      : 0;

    const avgSearchesPerSession = deviceStats.length > 0
      ? deviceStats.reduce((sum, d) => sum + d.searchCount, 0) / deviceStats.length
      : 0;

    // Engagement distribution
    const engagementDistribution = [
      { level: 'high', count: powerUsers },
      { level: 'medium', count: Math.floor(casualUsers * 0.5) },
      { level: 'low', count: Math.floor(casualUsers * 0.5) }
    ];

    // Retention (simplified - users who returned)
    const retention = 45.5; // Placeholder - would need historical data to calculate properly

    res.json({
      activeUsers: totalActiveUsers,
      powerUsers,
      casualUsers,
      retention: parseFloat(retention.toFixed(1)),
      avgEventsPerSession: parseFloat(avgEventsPerSession.toFixed(1)),
      avgSearchesPerSession: parseFloat(avgSearchesPerSession.toFixed(1)),
      engagementDistribution
    });
  } catch (err) {
    console.error('Error fetching user engagement:', err);
    res.status(500).json({ error: 'Failed to fetch user engagement' });
  }
});

/**
 * GET /api/analytics/geographic
 * Get geographic analytics
 */
router.get('/geographic', validateAppId, protect, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // City analytics
    const cities = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, city: { $ne: null } } },
      {
        $group: {
          _id: '$city',
          views: { $sum: 1 },
          uniqueEvents: { $addToSet: '$eventId' }
        }
      },
      {
        $project: {
          city: '$_id',
          views: 1,
          count: '$views',
          events: { $size: '$uniqueEvents' },
          _id: 0
        }
      },
      { $sort: { views: -1 } }
    ]);

    // City filter usage
    const cityFilters = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'city_changed', city: { $ne: null } } },
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      {
        $project: {
          city: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      cities,
      cityFilters,
      regionalPreferences: cities.slice(0, 10) // Top 10 cities as regional preferences
    });
  } catch (err) {
    console.error('Error fetching geographic analytics:', err);
    res.status(500).json({ error: 'Failed to fetch geographic analytics' });
  }
});

/**
 * GET /api/analytics/filters
 * Get filter analytics
 */
router.get('/filters', validateAppId, protect, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // Most used filters
    const mostUsed = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'filter_applied', filterType: { $ne: null } } },
      {
        $group: {
          _id: '$filterType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      {
        $project: {
          filterType: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Filter combinations (simplified)
    const combinations = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'filter_applied', filterType: { $ne: null }, filterValue: { $ne: null } } },
      {
        $group: {
          _id: { type: '$filterType', value: '$filterValue' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $project: {
          filterType: '$_id.type',
          filterValue: '$_id.value',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Effectiveness (filters that led to event views/clicks)
    const effectiveness = await AnalyticsEvent.aggregate([
      {
        $facet: {
          filters: [
            { $match: { ...dateFilter, event: 'filter_applied', filterType: { $ne: null } } },
            {
              $group: {
                _id: '$filterType',
                count: { $sum: 1 }
              }
            }
          ],
          views: [
            { $match: { ...dateFilter, event: 'event_viewed', filterType: { $ne: null } } },
            {
              $group: {
                _id: '$filterType',
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    const filterMap = {};
    effectiveness[0].filters.forEach(f => { filterMap[f._id] = { applied: f.count, views: 0 }; });
    effectiveness[0].views.forEach(v => { if (filterMap[v._id]) filterMap[v._id].views = v.count; });

    const effectivenessData = Object.keys(filterMap).map(type => ({
      filterType: type,
      applied: filterMap[type].applied,
      views: filterMap[type].views,
      effectiveness: filterMap[type].applied > 0 
        ? ((filterMap[type].views / filterMap[type].applied) * 100).toFixed(1)
        : 0
    }));

    // Abandonment rate (simplified placeholder)
    const abandonmentRate = 15.5;

    res.json({
      mostUsed,
      combinations,
      effectiveness: effectivenessData,
      abandonmentRate: parseFloat(abandonmentRate.toFixed(1))
    });
  } catch (err) {
    console.error('Error fetching filter analytics:', err);
    res.status(500).json({ error: 'Failed to fetch filter analytics' });
  }
});

/**
 * GET /api/analytics/screen-flow
 * Get screen flow and user journey analytics
 */
router.get('/screen-flow', validateAppId, protect, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // Screen views
    const screens = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, screen: { $ne: null } } },
      {
        $group: {
          _id: '$screen',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      {
        $project: {
          screen: '$_id',
          count: 1,
          views: '$count',
          _id: 0
        }
      }
    ]);

    // User paths (simplified - would need session tracking for full paths)
    const paths = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, screen: { $ne: null } } },
      {
        $group: {
          _id: '$deviceId',
          screens: { $push: '$screen' }
        }
      },
      {
        $project: {
          path: { $slice: ['$screens', 3] } // First 3 screens as path
        }
      },
      {
        $group: {
          _id: { $concat: { $map: { input: '$path', as: 's', in: '$$s' } } },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $project: {
          path: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Drop-offs (screens with no subsequent events)
    const dropOffs = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, screen: { $ne: null } } },
      {
        $group: {
          _id: '$screen',
          count: { $sum: 1 },
          lastEvents: { $push: { screen: '$screen', timestamp: '$timestamp' } }
        }
      },
      {
        $project: {
          screen: '$_id',
          count: 1,
          rate: { $multiply: [{ $divide: [10, 100] }, 100] } // Placeholder calculation
        }
      }
    ]);

    res.json({
      screens,
      paths,
      dropOffs
    });
  } catch (err) {
    console.error('Error fetching screen flow analytics:', err);
    res.status(500).json({ error: 'Failed to fetch screen flow analytics' });
  }
});

/**
 * GET /api/analytics/links
 * Get link performance analytics
 */
router.get('/links', validateAppId, protect, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // Links by type
    const byType = await AnalyticsEvent.aggregate([
      {
        $match: {
          ...dateFilter,
          event: { $in: ['link_clicked', 'website_clicked', 'ticket_link_clicked', 'instagram_clicked'] }
        }
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $eq: ['$event', 'website_clicked'] }, then: 'website' },
                { case: { $eq: ['$event', 'ticket_link_clicked'] }, then: 'ticket' },
                { case: { $eq: ['$event', 'instagram_clicked'] }, then: 'instagram' },
                { case: { $eq: ['$event', 'link_clicked'] }, then: 'other' }
              ],
              default: 'other'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Links by event
    const byEvent = await AnalyticsEvent.aggregate([
      {
        $match: {
          ...dateFilter,
          event: { $in: ['link_clicked', 'website_clicked', 'ticket_link_clicked', 'instagram_clicked'] },
          eventId: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$eventId',
          eventName: { $first: '$eventName' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $project: {
          eventId: '$_id',
          eventName: 1,
          count: 1,
          _id: 0
        }
      }
    ]);

    // Conversion rate (link clicks vs event views)
    const linkClicks = await AnalyticsEvent.countDocuments({
      ...dateFilter,
      event: { $in: ['link_clicked', 'website_clicked', 'ticket_link_clicked', 'instagram_clicked'] }
    });

    const eventViews = await AnalyticsEvent.countDocuments({
      ...dateFilter,
      event: 'event_viewed'
    });

    const conversionRate = eventViews > 0 ? (linkClicks / eventViews) * 100 : 0;

    res.json({
      byType,
      byEvent,
      conversionRate: parseFloat(conversionRate.toFixed(1)),
      totalClicks: linkClicks
    });
  } catch (err) {
    console.error('Error fetching link analytics:', err);
    res.status(500).json({ error: 'Failed to fetch link analytics' });
  }
});

/**
 * GET /api/analytics/time
 * Get time-based analytics
 */
router.get('/time', validateAppId, protect, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // Hourly distribution
    const hourly = await AnalyticsEvent.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          hour: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Daily distribution
    const daily = await AnalyticsEvent.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dayOfWeek: '$timestamp' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          day: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 1] }, then: 'Sunday' },
                { case: { $eq: ['$_id', 2] }, then: 'Monday' },
                { case: { $eq: ['$_id', 3] }, then: 'Tuesday' },
                { case: { $eq: ['$_id', 4] }, then: 'Wednesday' },
                { case: { $eq: ['$_id', 5] }, then: 'Thursday' },
                { case: { $eq: ['$_id', 6] }, then: 'Friday' },
                { case: { $eq: ['$_id', 7] }, then: 'Saturday' }
              ],
              default: 'Unknown'
            }
          },
          count: 1,
          _id: 0
        }
      }
    ]);

    // Weekly distribution
    const weekly = await AnalyticsEvent.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-W%V', date: '$timestamp' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          week: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      hourly,
      daily,
      weekly
    });
  } catch (err) {
    console.error('Error fetching time-based analytics:', err);
    res.status(500).json({ error: 'Failed to fetch time-based analytics' });
  }
});

/**
 * GET /api/analytics/funnels
 * Get conversion funnel analytics
 */
router.get('/funnels', validateAppId, protect, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // Search funnel
    const searchFunnel = [
      {
        stage: 'search',
        count: await AnalyticsEvent.countDocuments({ ...dateFilter, event: 'search_performed' })
      },
      {
        stage: 'result_view',
        count: await AnalyticsEvent.countDocuments({ ...dateFilter, event: 'search_result_clicked' })
      },
      {
        stage: 'detail_view',
        count: await AnalyticsEvent.countDocuments({ 
          ...dateFilter, 
          event: 'event_viewed',
          searchQuery: { $ne: null }
        })
      },
      {
        stage: 'link_click',
        count: await AnalyticsEvent.countDocuments({ 
          ...dateFilter, 
          event: { $in: ['link_clicked', 'website_clicked', 'ticket_link_clicked', 'instagram_clicked'] },
          searchQuery: { $ne: null }
        })
      }
    ];

    // Browse funnel
    const browseFunnel = [
      {
        stage: 'list_view',
        count: await AnalyticsEvent.countDocuments({ ...dateFilter, event: 'screen_view', screen: 'event_list' })
      },
      {
        stage: 'event_click',
        count: await AnalyticsEvent.countDocuments({ ...dateFilter, event: 'event_clicked' })
      },
      {
        stage: 'detail_view',
        count: await AnalyticsEvent.countDocuments({ ...dateFilter, event: 'event_viewed' })
      },
      {
        stage: 'link_click',
        count: await AnalyticsEvent.countDocuments({ 
          ...dateFilter, 
          event: { $in: ['link_clicked', 'website_clicked', 'ticket_link_clicked', 'instagram_clicked'] }
        })
      }
    ];

    // Filter funnel
    const filterFunnel = [
      {
        stage: 'filter_applied',
        count: await AnalyticsEvent.countDocuments({ ...dateFilter, event: 'filter_applied' })
      },
      {
        stage: 'event_view',
        count: await AnalyticsEvent.countDocuments({ 
          ...dateFilter, 
          event: 'event_viewed',
          filterType: { $ne: null }
        })
      },
      {
        stage: 'event_click',
        count: await AnalyticsEvent.countDocuments({ 
          ...dateFilter, 
          event: 'event_clicked',
          filterType: { $ne: null }
        })
      }
    ];

    res.json({
      searchFunnel,
      browseFunnel,
      filterFunnel
    });
  } catch (err) {
    console.error('Error fetching funnel analytics:', err);
    res.status(500).json({ error: 'Failed to fetch funnel analytics' });
  }
});

/**
 * GET /api/analytics/overview
 * Get overview metrics for dashboard
 */
router.get('/overview', validateAppId, protect, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // Total events viewed
    const totalEventsViewed = await AnalyticsEvent.countDocuments({
      ...dateFilter,
      event: 'event_viewed'
    });

    // Total searches
    const totalSearches = await AnalyticsEvent.countDocuments({
      ...dateFilter,
      event: 'search_performed'
    });

    // Total link clicks
    const totalLinkClicks = await AnalyticsEvent.countDocuments({
      ...dateFilter,
      event: { $in: ['link_clicked', 'website_clicked', 'ticket_link_clicked', 'instagram_clicked'] }
    });

    // Active users
    const activeUsers = await AnalyticsEvent.distinct('deviceId', dateFilter);

    // Most popular event
    const mostPopularEvent = await AnalyticsEvent.aggregate([
      { $match: { ...dateFilter, event: 'event_viewed', eventId: { $ne: null } } },
      {
        $group: {
          _id: '$eventId',
          eventName: { $first: '$eventName' },
          views: { $sum: 1 }
        }
      },
      { $sort: { views: -1 } },
      { $limit: 1 },
      {
        $project: {
          eventId: '$_id',
          eventName: 1,
          views: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      totalEventsViewed,
      totalSearches,
      totalLinkClicks,
      activeUsers: activeUsers.length,
      mostPopularEvent: mostPopularEvent[0] || null
    });
  } catch (err) {
    console.error('Error fetching overview analytics:', err);
    res.status(500).json({ error: 'Failed to fetch overview analytics' });
  }
});

module.exports = router;

