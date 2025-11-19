import React from 'react';
import { format } from 'date-fns';
import './EventCard.css';

function EventCard({ event, onEdit, onDelete }) {
  return (
    <div className="event-card">
      {event.imageUrl && (
        <div className="event-card-image">
          <img src={event.imageUrl} alt={event.name} />
        </div>
      )}
      <div className="event-card-content">
        <h3>{event.name}</h3>
        {event.description && (
          <p className="event-description">{event.description.substring(0, 150)}...</p>
        )}
        <div className="event-details">
          {event.startDate && (
            <div className="detail-item">
              <strong>Date:</strong> {format(new Date(event.startDate), 'PPp')}
            </div>
          )}
          {event.city && (
            <div className="detail-item">
              <strong>City:</strong> {event.city}
            </div>
          )}
          {event.venueName && (
            <div className="detail-item">
              <strong>Venue:</strong> {event.venueName}
            </div>
          )}
          {event.type && (
            <div className="detail-item">
              <strong>Type:</strong> {event.type}
            </div>
          )}
          {event.music && event.music.length > 0 && (
            <div className="detail-item">
              <strong>Music:</strong> {event.music.join(', ')}
            </div>
          )}
          {event.price !== undefined && event.price !== null && (
            <div className="detail-item">
              <strong>Price:</strong> €{event.price}
            </div>
          )}
          {event.ourRecommendation && (
            <div className="recommendation-badge">⭐ Our Recommendation</div>
          )}
        </div>
        <div className="event-card-actions">
          <button onClick={onEdit} className="btn-edit">Edit</button>
          <button onClick={onDelete} className="btn-delete">Delete</button>
        </div>
      </div>
    </div>
  );
}

export default EventCard;

