# Guest Mode Implementation - Backend Changes

## Overview

The backend has been updated to support **guest mode** for the iOS app, allowing users to browse events without authentication. All API endpoints now require app identity validation via the `X-App-ID` header.

## Key Changes

### 1. **New Required Header: `X-App-ID`**

**All API requests** must now include the `X-App-ID` header with the value `outy-ios-app-2025`.

**Impact on Admin App:**
- ✅ **Admin app requests MUST include this header** for all API calls
- ✅ Without this header, requests will return `401 Unauthorized`
- ✅ Header value is case-sensitive and must match exactly: `outy-ios-app-2025`

### 2. **GET /api/events Endpoint Changes**

**Before:**
- No authentication required
- No app validation

**After:**
- ✅ Requires `X-App-ID` header (mandatory)
- ✅ Authentication token is **optional** (for guest mode support)
- ✅ Rate limiting applied (100 requests/15min for guests, 500/15min for authenticated)

**Impact on Admin App:**
- Admin app should include `X-App-ID: outy-ios-app-2025` header
- If admin app uses authentication tokens, include both headers
- Same response format - no breaking changes to response structure

### 3. **All Protected Endpoints**

**Before:**
- Required authentication token only

**After:**
- ✅ Requires `X-App-ID` header (mandatory)
- ✅ Still requires authentication token (no change)
- ✅ Both headers must be present

**Affected Endpoints:**
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `POST /api/events/bulk` - Bulk create events
- `DELETE /api/events/series/:seriesId` - Delete series
- `GET /api/users/me` - Get user info
- `PUT /api/users/me` - Update user
- `POST /api/users/profile-image` - Upload profile image
- `GET /api/users` - Get all users (admin)
- `POST /api/tickets/upload` - Upload ticket
- `GET /api/tickets` - Get user tickets
- `GET /api/tickets/:id` - Get ticket by ID

### 4. **Auth Endpoints**

**Before:**
- No app validation

**After:**
- ✅ Requires `X-App-ID` header

**Affected Endpoints:**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

## Required Changes for Admin App

### Update All API Requests

Add the `X-App-ID` header to **all** API requests:

```javascript
// Example: Fetch events
fetch('https://your-api.com/api/events', {
  headers: {
    'X-App-ID': 'outy-ios-app-2025',
    'Content-Type': 'application/json',
    // If authenticated:
    'Authorization': `Bearer ${token}`
  }
});

// Example: Create event (requires auth)
fetch('https://your-api.com/api/events', {
  method: 'POST',
  headers: {
    'X-App-ID': 'outy-ios-app-2025',
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(eventData)
});
```

### Axios Configuration Example

```javascript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://your-api.com/api',
  headers: {
    'X-App-ID': 'outy-ios-app-2025',
    'Content-Type': 'application/json'
  }
});

// Add auth token interceptor if needed
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## Error Responses

### Missing or Invalid App ID (401)

```json
{
  "error": "Invalid or missing app identifier",
  "code": "INVALID_APP_ID"
}
```

### Rate Limit Exceeded (429)

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900
}
```

Response includes `Retry-After` header with seconds until limit resets.

## Migration Checklist

- [ ] Update all API request functions to include `X-App-ID: outy-ios-app-2025` header
- [ ] Test event creation (POST /api/events)
- [ ] Test event updates (PUT /api/events/:id)
- [ ] Test event deletion (DELETE /api/events/:id)
- [ ] Test bulk event creation (POST /api/events/bulk)
- [ ] Test user authentication endpoints (login/register)
- [ ] Verify error handling for missing/invalid app ID
- [ ] Test rate limiting behavior (if applicable)

## Testing

### Test Cases

1. **Valid Request with App ID**
   ```bash
   curl -X GET https://your-api.com/api/events \
     -H "X-App-ID: outy-ios-app-2025"
   ```
   ✅ Should return events

2. **Missing App ID**
   ```bash
   curl -X GET https://your-api.com/api/events
   ```
   ❌ Should return 401 with `INVALID_APP_ID` error

3. **Invalid App ID**
   ```bash
   curl -X GET https://your-api.com/api/events \
     -H "X-App-ID: wrong-app-id"
   ```
   ❌ Should return 401 with `INVALID_APP_ID` error

4. **Protected Endpoint with App ID but No Auth**
   ```bash
   curl -X POST https://your-api.com/api/events \
     -H "X-App-ID: outy-ios-app-2025" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Event"}'
   ```
   ❌ Should return 401 (still requires auth token)

5. **Protected Endpoint with Both Headers**
   ```bash
   curl -X POST https://your-api.com/api/events \
     -H "X-App-ID: outy-ios-app-2025" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Event"}'
   ```
   ✅ Should work if token is valid

## Notes

- **No breaking changes** to response formats - all endpoints return the same data structure
- **Rate limiting** is applied but shouldn't affect normal admin app usage (500 requests/15min for authenticated users)
- **Backward compatibility**: Old requests without `X-App-ID` will fail - this is intentional for security
- The app ID validation ensures only requests from the official app can access the API

## Questions?

If you encounter any issues or need clarification, please reach out to the backend team.


