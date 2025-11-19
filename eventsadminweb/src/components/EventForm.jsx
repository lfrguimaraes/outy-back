import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import './EventForm.css';

const MUSIC_GENRES = ['Pop', 'House', 'Techno', 'Afro', 'Hip Hop', 'Trance', 'Latino', 'Brazilian', 'Rock', 'Reggae'];
const EVENT_TYPES = ['Bar', 'Club', 'Concert', 'Cinema', 'Underground', 'Warehouse', 'Theater', 'Boat', 'Cruising', 'Sauna'];

function EventForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    price: '',
    address: '',
    city: '',
    venueName: '',
    instagram: '',
    website: '',
    ticketLink: '',
    startDate: '',
    endDate: '',
    ourRecommendation: false,
    music: [],
    type: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      loadEvent();
    }
  }, [id]);

  const loadEvent = async () => {
    try {
      const response = await eventsAPI.getById(id);
      const event = response.data;
      setFormData({
        name: event.name || '',
        description: event.description || '',
        imageUrl: event.imageUrl || '',
        price: event.price || '',
        address: event.address || '',
        city: event.city || '',
        venueName: event.venueName || '',
        instagram: event.instagram || '',
        website: event.website || '',
        ticketLink: event.ticketLink || '',
        startDate: event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : '',
        endDate: event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : '',
        ourRecommendation: event.ourRecommendation || false,
        music: event.music || [],
        type: event.type || ''
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load event');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleMusicChange = (genre) => {
    setFormData(prev => ({
      ...prev,
      music: prev.music.includes(genre)
        ? prev.music.filter(g => g !== genre)
        : [...prev.music, genre]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        price: formData.price ? parseFloat(formData.price) : undefined,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        endDate: formData.endDate ? new Date(formData.endDate) : undefined
      };

      if (isEdit) {
        await eventsAPI.update(id, submitData);
      } else {
        await eventsAPI.create(submitData);
      }
      navigate('/events');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="event-form-container">
      <header className="form-header">
        <h1>{isEdit ? 'Edit Event' : 'Create New Event'}</h1>
        <button onClick={() => navigate('/events')} className="btn-cancel">Cancel</button>
      </header>

      <form onSubmit={handleSubmit} className="event-form">
        {error && <div className="error-banner">{error}</div>}

        <div className="form-section">
          <h2>Basic Information</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Event Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Event Type</label>
              <select name="type" value={formData.type} onChange={handleChange}>
                <option value="">Select type</option>
                {EVENT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
            />
          </div>

          <div className="form-group">
            <label>Image URL</label>
            <input
              type="url"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Date & Time</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Start Date & Time *</label>
              <input
                type="datetime-local"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date & Time</label>
              <input
                type="datetime-local"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Location</h2>
          <div className="form-group">
            <label>Address *</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Venue Name</label>
              <input
                type="text"
                name="venueName"
                value={formData.venueName}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Links & Pricing</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Price</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label>Ticket Link</label>
              <input
                type="url"
                name="ticketLink"
                value={formData.ticketLink}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Instagram</label>
              <input
                type="text"
                name="instagram"
                value={formData.instagram}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Additional Options</h2>
          <div className="form-group">
            <label>Music Genres</label>
            <div className="checkbox-group">
              {MUSIC_GENRES.map(genre => (
                <label key={genre} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.music.includes(genre)}
                    onChange={() => handleMusicChange(genre)}
                  />
                  {genre}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="ourRecommendation"
                checked={formData.ourRecommendation}
                onChange={handleChange}
              />
              Our Recommendation
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/events')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EventForm;

