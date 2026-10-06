# AI Poster Generator (Multi-Client SaaS)

A production-grade, multi-client SaaS web application for automated branded poster generation, engineered for zero-config Vercel Serverless deployment.

---

## Architecture Overview

```
.
├── /api
│   └── index.js              # Vercel serverless function entry (exports Express app)
├── /server                   # Express backend (ES modules)
│   ├── config/
│   │   └── db.js             # Mongoose cached connection (global.__mongoose pattern)
│   ├── routes/
│   │   └── health.routes.js  # GET /api/health endpoint
│   ├── app.js                # Express app setup (helmet, 4.5MB json limit, error handling)
│   └── dev.js                # Local dev server runner (runs app.listen)
├── /client                   # Vite + React + Tailwind CSS client
│   ├── src/
│   │   ├── pages/            # Login, Dashboard, Generate, History
│   │   ├── services/api.js   # Axios instance with baseURL "/api"
│   │   ├── App.jsx           # App layout and React Router
│   │   └── main.jsx
│   ├── vite.config.js        # Dev proxy (/api -> http://localhost:5000)
│   └── tailwind.config.js
├── vercel.json               # Vercel serverless rewrites and build config
├── package.json              # Monorepo scripts
└── .env.example              # Environment variables template
```

---

## Getting Started Locally

### 1. Install Dependencies

Install root dependencies and client dependencies:

```bash
npm install
npm --prefix client install
```
*(Or use shortcut `npm run install:all`)*

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

*(You can run the health check and dev server immediately even without a MongoDB URI; it will start in standalone/offline mode).*

### 3. Run the Development Environment

Start both the Express backend and the Vite frontend concurrently:

```bash
npm run dev
```

- **Client Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Check Endpoint**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

Alternatively, run each service independently:
```bash
# Server only
npm run dev:server

# Client only
npm run dev:client
```

---

## Verifying Stage 1

1. Open your browser or curl the health endpoint:
   ```bash
   curl http://localhost:5000/api/health
   ```
   **Expected Response:**
   ```json
   {
     "status": "ok",
     "service": "AI Poster Generator API",
     "timestamp": "2026-09-30T...",
     "db": "unconfigured",
     "environment": "development",
     "uptime": 12,
     "vercel": false
   }
   ```
2. Navigate to [http://localhost:5173](http://localhost:5173). The Dashboard page will query `/api/health` via the Vite proxy and display green backend status badges.

---

## Deploying to Vercel

The repository is pre-configured with `vercel.json` for one-click Vercel deployment:

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Import the project into the [Vercel Dashboard](https://vercel.com).
3. Set the Environment Variables under **Project Settings > Environment Variables**:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: Random 256-bit secret string
   - `NODE_ENV`: `production`
4. Click **Deploy**.
   - `vercel.json` builds the client to `client/dist` and mounts the serverless Express API at `api/index.js` with a 30s max duration.
   - All `/api/*` routes are handled by the serverless function, and all other routes serve the SPA fallback.
