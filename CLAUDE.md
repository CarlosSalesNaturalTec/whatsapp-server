# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend Development
```bash
# Start in development mode (with file watching)
npm run dev

# Start in production mode
npm start

# Build the React frontend
npm run build:frontend
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev      # Vite dev server with proxy to backend at localhost:3000
npm run build    # Build to frontend/dist/
npm run preview  # Preview production build
```

### Production (PM2 on GCP VM)
```bash
pm2 start ecosystem.config.cjs   # Start with PM2
pm2 status                        # Check process status
pm2 logs whatsapp-app             # Stream logs
pm2 reload whatsapp-app           # Zero-downtime reload
pm2 restart whatsapp-app          # Hard restart
```

### Deployment Update
```bash
git pull
npm install
npm run build:frontend  # NODE_ENV=development is set internally by the script
pm2 reload whatsapp-app
```

## Architecture

This is a **monolithic Node.js application** (ESM modules, Node 20+) deployed on a single GCP Compute Engine VM, managed by PM2.

### Process Structure
A single process runs both the WhatsApp bot and the Express HTTP server. The bot is on-demand — it does **not** auto-connect on boot (only `tryAutoConnect()` runs at startup, which restores session silently if credentials exist in Secret Manager).

### Key Modules

**`src/bot/connectionManager.js`** — Singleton that owns the entire connection lifecycle.
- States: `disconnected` → `connecting` → `awaiting_pairing` → `connected` → `error`
- Provides `connect()`, `disconnect()`, `getStatus()`, `tryAutoConnect()`
- Handles reconnection with 5s delay on drop

**`src/bot/connection.js`** — Factory that creates and configures the Baileys WebSocket.
- Uses Pairing Code auth (no QR in terminal)
- Calls `onPairingCode`, `onConnected`, `onDisconnected` callbacks injected from `connectionManager`

**`src/bot/auth/secretManagerAuthState.js`** — Custom Baileys auth state adapter backed by GCP Secret Manager instead of the filesystem.
- Debounces key persistence writes by 3s to reduce GCP API quota usage
- Auto-creates the secret if it doesn't exist on first run
- Destroys old secret versions after saving a new one (keeps only latest)

**`src/server/routes/whatsapp.js`** — API routes for bot lifecycle management:
- `GET /api/whatsapp/status` — returns `{status, pairingCode}` (polled every 2s by frontend)
- `GET /api/whatsapp/config` — returns pre-configured phone number from env
- `POST /api/whatsapp/connect` — initiates connection (202 Accepted, async)
- `POST /api/whatsapp/disconnect` — tears down connection

**`src/bot/handlers/messageHandler.js`** — Registers the `messages.upsert` listener. Currently responds `"Bot Iniciado"` to messages containing `#iniciarBot#`.

### Frontend

React 18 + Vite + Tailwind CSS SPA served statically from `frontend/dist/` by Express.
- Custom client-side router (no react-router-dom) handles `/` and `/configuracoes`
- `/configuracoes` polls `/api/whatsapp/status` every 2s to display live connection state and pairing code
- Vite dev server proxies `/api/*` to `localhost:3000` for local development

### Credential Storage

WhatsApp session credentials are stored in **GCP Secret Manager** (not on disk). The secret name and GCP project are configured via environment variables. The application must run with a service account that has `secretmanager.secretVersions.*` permissions.

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `GCP_PROJECT_ID` | GCP project for Secret Manager | required in prod |
| `SECRET_NAME` | Secret Manager secret name | `whatsapp-baileys-auth` |
| `PHONE_NUMBER` | Pre-configured WhatsApp phone | required |
| `PORT` | HTTP server port | `3000` |
| `LOG_LEVEL` | Pino log level | `warn` |

### No Tests

There is no test suite. Logging with Pino is used for observability. All messages are structured JSON.
