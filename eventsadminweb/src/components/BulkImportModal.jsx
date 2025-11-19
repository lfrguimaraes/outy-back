import React, { useState } from 'react';
import { eventsAPI } from '../services/api';
import './BulkImportModal.css';

function BulkImportModal({ onClose, onSuccess }) {
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const events = JSON.parse(jsonText);
      if (!Array.isArray(events)) {
        throw new Error('JSON must be an array of events');
      }
      await eventsAPI.bulkCreate(events);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to import events. Please check your JSON format.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Bulk Import Events</h2>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Paste JSON array of events:</label>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows="15"
              placeholder='[{"name": "Event Name", "address": "123 Main St", ...}, ...]'
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Importing...' : 'Import Events'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BulkImportModal;

