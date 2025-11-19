# Events Admin Web Application

Admin web interface for managing events in the LGBT Agenda backend.

## Features

- 🔐 JWT Authentication
- 📋 Event listing with comprehensive search and filters
- 🔍 Search by name, description, venue, address, city, and more
- 🎛️ Advanced filters: city, type, music genres, venue, dates, price, links
- ➕ Create new events
- ✏️ Edit existing events
- 🗑️ Delete events
- 📦 Bulk import events from JSON
- 🎨 Modern, responsive UI

## Development

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```env
VITE_API_URL=http://localhost:5050/api
```

3. Start development server:
```bash
npm run dev
```

The app will run on `http://localhost:3001` (or next available port).

## Building for Production

1. Build the application:
```bash
npm run build
```

2. The `dist` folder will contain the production-ready static files.

3. The backend server is configured to serve the `dist` folder at `/admin` route in production mode.

## Search & Filter Features

### Global Search
- Searches across: name, description, venue name, address, city, Instagram, website, ticket link
- Real-time filtering as you type

### Advanced Filters
- **City**: Filter by city (dropdown)
- **Event Type**: Bar, Club, Concert, Cinema, etc.
- **Venue Name**: Text search for venue
- **Music Genres**: Multi-select checkboxes (Pop, House, Techno, etc.)
- **Recommendation**: Show only recommended events
- **Date Range**: Filter by start date (from/to)
- **Price Range**: Filter by min/max price
- **Links**: Filter by presence of ticket link, Instagram, or website

### Active Filters Display
- See all active filters at a glance
- Quick remove individual filters
- Clear all filters button

