import React from 'react';
import { FlightProvider } from './context/FlightContext';
import { DashboardLayout } from './components/DashboardLayout';

// Get credentials from environment variables
const OPENSKY_CLIENT_ID = import.meta.env.VITE_OPENSKY_CLIENT_ID || '';
const OPENSKY_CLIENT_SECRET = import.meta.env.VITE_OPENSKY_CLIENT_SECRET || '';

function App() {
  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        textAlign: 'center'
      }}>
        <h2>Configuration Required</h2>
        <p>Please set up your OpenSky Network API credentials:</p>
        <ol style={{ textAlign: 'left', maxWidth: '600px' }}>
          <li>Create a <code>.env</code> file in the project root</li>
          <li>Add your OpenSky Network OAuth2 credentials:</li>
          <pre style={{
            background: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            textAlign: 'left'
          }}>
            VITE_OPENSKY_CLIENT_ID=your_client_id{'\n'}
            VITE_OPENSKY_CLIENT_SECRET=your_client_secret
          </pre>
          <li>Restart the development server</li>
        </ol>
        <p style={{ fontSize: '14px', color: '#666' }}>
          To get credentials, visit:{' '}
          <a href="https://opensky-network.org" target="_blank" rel="noopener noreferrer">
            https://opensky-network.org
          </a>
        </p>
      </div>
    );
  }

  return (
    <FlightProvider clientId={OPENSKY_CLIENT_ID} clientSecret={OPENSKY_CLIENT_SECRET}>
      <DashboardLayout />
    </FlightProvider>
  );
}

export default App;
