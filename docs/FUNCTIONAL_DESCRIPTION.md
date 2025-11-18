## LGBT Agenda Backend – Functional Description

This service provides the backend API for LGBT Agenda: user authentication and profiles, event management, and ticket handling. It is built with Express and MongoDB (Mongoose), uses JWT for auth, Cloudinary for image uploads, and supports address geocoding to place events on a map.

### Core Capabilities

- Authentication
  - User registration with unique email and hashed password
  - Login returns a JWT (expires in 7 days)
  - Protected routes via Bearer token

- Users
  - Get current user profile
  - Update profile fields: name, age, sexualPosition, tribe, preferredCity
  - Upload and set profile image (stored on Cloudinary)
  - List all users (currently protected; intended for admin usage)

- Events
  - Create single event (admin). Address is geocoded to lat/lng
  - Bulk create events with automatic geocoding
  - List events with optional filters: city, date (>=), id
  - Get event by id
  - Update or delete event (admin)

- Tickets
  - Upload a ticket QR image to Cloudinary and persist the ticket (user scoped)
  - List tickets for the authenticated user
  - Get a single ticket (only if it belongs to the requesting user)

### Data Models

- User
  - name, email, password (hashed), age, sexualPosition, tribe, profileImageUrl, preferredCity, role

- Event
  - name (required), description, imageUrl, price, location { lat, lng }, instagram, website, ticketLink, address, city, venueName, date, startDate (required), endDate (validated to be >= startDate), ourRecommendation (boolean, default: false), music (array of strings: Pop, House, Techno, Afro, Hip Hop, Trance, Dance Latino, Brazilian, Rock, Reggae), type (string: Bar, Club, Concert, Cinema, Underground, Warehouse, Theater, Boat, Cruising, Sauna)

- Ticket
  - userId (ref User), eventId (ref Event), qrImageUrl

### Authentication & Authorization

- JWT Bearer tokens are expected on protected routes in the `Authorization: Bearer <token>` header.
- Admin-only operations use an admin middleware to restrict access (event creation/update/delete).

### External Integrations

- Cloudinary for image hosting (profile images, ticket QR images)
- Geocoding utility to resolve event addresses into geographic coordinates

### Running

- Start server: `npm start` (uses `server.js`)
- Dev mode (alt): `npm run dev` (uses `app.js` demo server)

### API Documentation

- OpenAPI spec is provided at `docs/openapi.json` and served at `/openapi.json`.
- Interactive Swagger UI is mounted at `/api-docs`.


