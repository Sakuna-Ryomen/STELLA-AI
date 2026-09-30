import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { getSystemStatsPayload } from './src/electron/systemStats.js'
import { generateLiveKitToken } from './src/electron/livekitToken.js'

let chatMessagesQueue = [];
let aiCoreState = 'idle';

function systemStatsPlugin() {
  return {
    name: 'system-stats-endpoint',
    configureServer(server) {
      // LiveKit Token Dispenser
      server.middlewares.use('/api/livekit-token', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        try {
          const data = generateLiveKitToken();
          res.end(JSON.stringify(data));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // Real-time System Hardware Stats
      server.middlewares.use('/api/system-stats', (req, res) => {
        try {
          const data = getSystemStatsPayload();
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(data));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // Real-time AI Voice State Synchronization Endpoint
      server.middlewares.use('/api/state', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              if (data.state) {
                aiCoreState = data.state;
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'ok', state: aiCoreState }));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ state: aiCoreState }));
          return;
        }
      });

      // Python Assistant Chat Integration Endpoint
      server.middlewares.use('/api/chat', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const now = new Date();
              const timeStr = data.time || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const msg = {
                id: data.id || ('msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
                role: data.role || 'stella',
                text: data.text || '',
                time: timeStr,
                timestamp: Date.now()
              };
              chatMessagesQueue.push(msg);
              if (chatMessagesQueue.length > 50) chatMessagesQueue.shift();
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'ok', message: msg }));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(chatMessagesQueue));
          return;
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    systemStatsPlugin(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true
    }
  }
})
