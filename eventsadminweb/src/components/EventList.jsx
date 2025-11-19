import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import { removeToken } from '../services/auth';
import EventCard from './EventCard';
import BulkImportModal from './BulkImportModal';
import './EventList.css';

const MUSIC_GENRES = ['Pop', 'House', 'Techno', 'Afro', 'Hip Hop', 'Trance', 'Latino', 'Brazilian', 'Rock', 'Reggae'];
const EVENT_TYPES = ['Bar', 'Club', 'Concert', 'Cinema', 'Underground', 'Warehouse', 'Theater', 'Boat', 'Cruising', 'Sauna'];

function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    city: '',
    type: '',
    music: [],
    venueName: '',
    ourRecommendation: null, // null = all, true = recommended, false = not recommended
    dateFrom: '',
    dateTo: '',
    priceMin: '',
    priceMax: '',
    hasTicketLink: null,
    hasInstagram: null,
    hasWebsite: null
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await eventsAPI.getAll();
      setEvents(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Filter events based on search query and filters
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Text search across multiple fields
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          event.name,
          event.description,
          event.venueName,
          event.address,
          event.city,
          event.instagram,
          event.website,
          event.ticketLink
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(query)) {
          return false;
        }
      }

      // City filter
      if (filters.city && event.city?.toLowerCase() !== filters.city.toLowerCase()) {
        return false;
      }

      // Type filter
      if (filters.type && event.type !== filters.type) {
        return false;
      }

      // Music genre filter (event must have at least one selected genre)
      if (filters.music.length > 0) {
        const hasMatchingGenre = filters.music.some(genre => 
          event.music?.includes(genre)
        );
        if (!hasMatchingGenre) {
          return false;
        }
      }

      // Venue name filter
      if (filters.venueName) {
        const venueQuery = filters.venueName.toLowerCase();
        if (!event.venueName?.toLowerCase().includes(venueQuery)) {
          return false;
        }
      }

      // Recommendation filter
      if (filters.ourRecommendation !== null) {
        if (event.ourRecommendation !== filters.ourRecommendation) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateFrom && event.startDate) {
        const eventDate = new Date(event.startDate);
        const fromDate = new Date(filters.dateFrom);
        if (eventDate < fromDate) {
          return false;
        }
      }

      if (filters.dateTo && event.startDate) {
        const eventDate = new Date(event.startDate);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999); // Include entire end date
        if (eventDate > toDate) {
          return false;
        }
      }

      // Price range filter
      if (filters.priceMin && (event.price === undefined || event.price < parseFloat(filters.priceMin))) {
        return false;
      }

      if (filters.priceMax && (event.price === undefined || event.price > parseFloat(filters.priceMax))) {
        return false;
      }

      // Has ticket link filter
      if (filters.hasTicketLink !== null) {
        const hasLink = !!event.ticketLink;
        if (hasLink !== filters.hasTicketLink) {
          return false;
        }
      }

      // Has Instagram filter
      if (filters.hasInstagram !== null) {
        const hasInsta = !!event.instagram;
        if (hasInsta !== filters.hasInstagram) {
          return false;
        }
      }

      // Has website filter
      if (filters.hasWebsite !== null) {
        const hasWeb = !!event.website;
        if (hasWeb !== filters.hasWebsite) {
          return false;
        }
      }

      return true;
    });
  }, [events, searchQuery, filters]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      await eventsAPI.delete(id);
      loadEvents();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete event');
    }
  };

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleMusicFilterChange = (genre) => {
    setFilters(prev => ({
      ...prev,
      music: prev.music.includes(genre)
        ? prev.music.filter(g => g !== genre)
        : [...prev.music, genre]
    }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      city: '',
      type: '',
      music: [],
      venueName: '',
      ourRecommendation: null,
      dateFrom: '',
      dateTo: '',
      priceMin: '',
      priceMax: '',
      hasTicketLink: null,
      hasInstagram: null,
      hasWebsite: null
    });
  };

  // Get unique values for dropdowns
  const cities = [...new Set(events.map(e => e.city).filter(Boolean))].sort();
  const venues = [...new Set(events.map(e => e.venueName).filter(Boolean))].sort();

  const hasActiveFilters = searchQuery || 
    filters.city || 
    filters.type || 
    filters.music.length > 0 || 
    filters.venueName ||
    filters.ourRecommendation !== null ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.priceMin ||
    filters.priceMax ||
    filters.hasTicketLink !== null ||
    filters.hasInstagram !== null ||
    filters.hasWebsite !== null;

  return (
    <div className="event-list-container">
      <header className="event-list-header">
        <h1>Events Administration</h1>
        <div className="header-actions">
          <button onClick={() => setShowBulkImport(true)} className="btn-secondary">
            Bulk Import
          </button>
          <button onClick={() => navigate('/events/new')} className="btn-primary">
            + New Event
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search events by name, description, venue, address, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        <div className="search-stats">
          Showing {filteredEvents.length} of {events.length} events
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn-clear-filters">
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Filters Toggle */}
      <div className="filters-toggle">
        <button 
          onClick={() => setShowFilters(!showFilters)} 
          className={`btn-toggle-filters ${showFilters ? 'active' : ''}`}
        >
          {showFilters ? '▼' : '▶'} Advanced Filters
        </button>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            {/* City Filter */}
            <div className="filter-group">
              <label>City</label>
              <select 
                value={filters.city} 
                onChange={(e) => handleFilterChange('city', e.target.value)}
              >
                <option value="">All Cities</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="filter-group">
              <label>Event Type</label>
              <select 
                value={filters.type} 
                onChange={(e) => handleFilterChange('type', e.target.value)}
              >
                <option value="">All Types</option>
                {EVENT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Venue Filter */}
            <div className="filter-group">
              <label>Venue Name</label>
              <input
                type="text"
                placeholder="Filter by venue..."
                value={filters.venueName}
                onChange={(e) => handleFilterChange('venueName', e.target.value)}
              />
            </div>

            {/* Recommendation Filter */}
            <div className="filter-group">
              <label>Recommendation</label>
              <select 
                value={filters.ourRecommendation === null ? '' : filters.ourRecommendation.toString()} 
                onChange={(e) => handleFilterChange('ourRecommendation', e.target.value === '' ? null : e.target.value === 'true')}
              >
                <option value="">All Events</option>
                <option value="true">Recommended Only</option>
                <option value="false">Not Recommended</option>
              </select>
            </div>

            {/* Date From */}
            <div className="filter-group">
              <label>From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className="filter-group">
              <label>To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>

            {/* Price Min */}
            <div className="filter-group">
              <label>Min Price</label>
              <input
                type="number"
                placeholder="0"
                step="0.01"
                value={filters.priceMin}
                onChange={(e) => handleFilterChange('priceMin', e.target.value)}
              />
            </div>

            {/* Price Max */}
            <div className="filter-group">
              <label>Max Price</label>
              <input
                type="number"
                placeholder="∞"
                step="0.01"
                value={filters.priceMax}
                onChange={(e) => handleFilterChange('priceMax', e.target.value)}
              />
            </div>

            {/* Has Ticket Link */}
            <div className="filter-group">
              <label>Has Ticket Link</label>
              <select 
                value={filters.hasTicketLink === null ? '' : filters.hasTicketLink.toString()} 
                onChange={(e) => handleFilterChange('hasTicketLink', e.target.value === '' ? null : e.target.value === 'true')}
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            {/* Has Instagram */}
            <div className="filter-group">
              <label>Has Instagram</label>
              <select 
                value={filters.hasInstagram === null ? '' : filters.hasInstagram.toString()} 
                onChange={(e) => handleFilterChange('hasInstagram', e.target.value === '' ? null : e.target.value === 'true')}
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            {/* Has Website */}
            <div className="filter-group">
              <label>Has Website</label>
              <select 
                value={filters.hasWebsite === null ? '' : filters.hasWebsite.toString()} 
                onChange={(e) => handleFilterChange('hasWebsite', e.target.value === '' ? null : e.target.value === 'true')}
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          {/* Music Genres Filter */}
          <div className="filter-section">
            <label className="filter-section-label">Music Genres</label>
            <div className="music-genres-filter">
              {MUSIC_GENRES.map(genre => (
                <label key={genre} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.music.includes(genre)}
                    onChange={() => handleMusicFilterChange(genre)}
                  />
                  {genre}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="active-filters">
          <strong>Active Filters:</strong>
          {searchQuery && (
            <span className="filter-tag">
              Search: "{searchQuery}"
              <button onClick={() => setSearchQuery('')}>×</button>
            </span>
          )}
          {filters.city && (
            <span className="filter-tag">
              City: {filters.city}
              <button onClick={() => handleFilterChange('city', '')}>×</button>
            </span>
          )}
          {filters.type && (
            <span className="filter-tag">
              Type: {filters.type}
              <button onClick={() => handleFilterChange('type', '')}>×</button>
            </span>
          )}
          {filters.music.length > 0 && (
            <span className="filter-tag">
              Music: {filters.music.join(', ')}
              <button onClick={() => handleFilterChange('music', [])}>×</button>
            </span>
          )}
          {filters.venueName && (
            <span className="filter-tag">
              Venue: {filters.venueName}
              <button onClick={() => handleFilterChange('venueName', '')}>×</button>
            </span>
          )}
          {filters.ourRecommendation !== null && (
            <span className="filter-tag">
              {filters.ourRecommendation ? 'Recommended' : 'Not Recommended'}
              <button onClick={() => handleFilterChange('ourRecommendation', null)}>×</button>
            </span>
          )}
          {(filters.dateFrom || filters.dateTo) && (
            <span className="filter-tag">
              Date: {filters.dateFrom || '...'} to {filters.dateTo || '...'}
              <button onClick={() => { handleFilterChange('dateFrom', ''); handleFilterChange('dateTo', ''); }}>×</button>
            </span>
          )}
          {(filters.priceMin || filters.priceMax) && (
            <span className="filter-tag">
              Price: {filters.priceMin || '0'} - {filters.priceMax || '∞'}
              <button onClick={() => { handleFilterChange('priceMin', ''); handleFilterChange('priceMax', ''); }}>×</button>
            </span>
          )}
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Loading events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="empty-state">
          <p>{hasActiveFilters ? 'No events match your filters.' : 'No events found.'}</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn-primary">
              Clear Filters
            </button>
          )}
          {!hasActiveFilters && (
            <button onClick={() => navigate('/events/new')} className="btn-primary">
              Create Your First Event
            </button>
          )}
        </div>
      ) : (
        <div className="events-grid">
          {filteredEvents.map(event => (
            <EventCard
              key={event._id}
              event={event}
              onEdit={() => navigate(`/events/edit/${event._id}`)}
              onDelete={() => handleDelete(event._id)}
            />
          ))}
        </div>
      )}

      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            setShowBulkImport(false);
            loadEvents();
          }}
        />
      )}
    </div>
  );
}

export default EventList;

