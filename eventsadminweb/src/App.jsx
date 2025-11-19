import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import EventList from './components/EventList';
import EventForm from './components/EventForm';
import { getToken } from './services/auth';
import './styles/App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());

  useEffect(() => {
    setIsAuthenticated(!!getToken());
  }, []);

  return (
    <Router basename="/admin">
      <div className="app">
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/events" /> : <Login onLogin={() => setIsAuthenticated(true)} />
            } 
          />
          <Route 
            path="/events" 
            element={
              isAuthenticated ? <EventList /> : <Navigate to="/login" />
            } 
          />
          <Route 
            path="/events/new" 
            element={
              isAuthenticated ? <EventForm /> : <Navigate to="/login" />
            } 
          />
          <Route 
            path="/events/edit/:id" 
            element={
              isAuthenticated ? <EventForm /> : <Navigate to="/login" />
            } 
          />
          <Route path="/" element={<Navigate to="/events" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

