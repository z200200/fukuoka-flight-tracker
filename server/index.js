import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'https://fukuoka-flight-tracker.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true
}));

app.use(express.json());

// Token cache
let cachedToken = null;
let tokenExpiry = 0;

// Check if credentials are configured
const hasCredentials = process.env.OPENSKY_CLIENT_ID &&
  process.env.OPENSKY_CLIENT_ID !== 'your_client_id_here' &&
  process.env.OPENSKY_CLIENT_SECRET &&
  process.env.OPENSKY_CLIENT_SECRET !== 'your_client_secret_here';

// Get OAuth2 token (only if credentials configured)
async function getToken() {
  if (!hasCredentials) {
    return null; // Use anonymous mode
  }

  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  try {
    const response = await axios.post(
      'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.OPENSKY_CLIENT_ID,
        client_secret: process.env.OPENSKY_CLIENT_SECRET,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000;

    console.log('✅ Token obtained successfully');
    return cachedToken;
  } catch (error) {
    console.error('❌ Failed to get token:', error.message);
    console.log('⚠️ Falling back to anonymous mode');
    return null;
  }
}

// Request counter for logging
let requestCount = 0;
let lastRequestTime = Date.now();

// Proxy API request helper
async function proxyRequest(req, res, endpoint) {
  requestCount++;
  const requestId = requestCount;
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  lastRequestTime = now;

  console.log(`[${new Date().toISOString()}] #${requestId} Request: ${endpoint} (${timeSinceLastRequest}ms since last)`);

  try {
    const token = await getToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await axios.get(`https://opensky-network.org/api${endpoint}`, {
      params: req.query,
      headers,
      timeout: 30000
    });

    // Forward rate limit headers
    const remaining = response.headers['x-rate-limit-remaining'];
    const retryAfter = response.headers['x-rate-limit-retry-after-seconds'];

    if (remaining) {
      res.setHeader('x-rate-limit-remaining', remaining);
      console.log(`[${new Date().toISOString()}] #${requestId} Success: ${endpoint} (remaining: ${remaining})`);
    } else {
      console.log(`[${new Date().toISOString()}] #${requestId} Success: ${endpoint}`);
    }

    if (retryAfter) {
      res.setHeader('x-rate-limit-retry-after-seconds', retryAfter);
    }

    res.json(response.data);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] #${requestId} ❌ Error for ${endpoint}: ${error.message}`);

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['x-rate-limit-retry-after-seconds'] || 60;
      console.warn(`[${new Date().toISOString()}] #${requestId} ⚠️ Rate limited! Retry after: ${retryAfter}s`);
      res.status(429).json({
        error: 'Rate limited',
        retryAfter: retryAfter
      });
    } else if (error.response?.status === 404) {
      // OpenSky API returns 404 when no data available, return empty array
      console.log(`[${new Date().toISOString()}] #${requestId} ℹ️ No data available for ${endpoint}, returning empty array`);
      res.json([]);
    } else {
      res.status(error.response?.status || 500).json({
        error: error.message,
        details: error.response?.data
      });
    }
  }
}

// API endpoints
app.get('/api/states/all', (req, res) => proxyRequest(req, res, '/states/all'));

// Flights endpoints (require authentication)
app.get('/api/flights/arrival', async (req, res) => {
  if (!hasCredentials) {
    // Anonymous mode: return empty array (endpoint requires auth)
    return res.json([]);
  }
  proxyRequest(req, res, '/flights/arrival');
});

app.get('/api/flights/departure', async (req, res) => {
  if (!hasCredentials) {
    // Anonymous mode: return empty array (endpoint requires auth)
    return res.json([]);
  }
  proxyRequest(req, res, '/flights/departure');
});

app.get('/api/tracks', (req, res) => proxyRequest(req, res, '/tracks/all'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    tokenCached: !!cachedToken,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying OpenSky Network API requests`);
  if (hasCredentials) {
    console.log(`🔐 Mode: Authenticated (higher rate limits)`);
  } else {
    console.log(`🔓 Mode: Anonymous (limited to ~100 requests/day)`);
    console.log(`💡 To get higher limits, register at https://opensky-network.org/`);
  }
});
