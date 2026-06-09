# IntellMeet — Deployment Guide

A complete, step-by-step guide to deploying the IntellMeet application in every environment:
**Local Development → Docker Compose → Cloud (Render + Vercel + MongoDB Atlas) with CI/CD**.

---

## 📋 Table of Contents

1. [Environment Variables Reference](#1-environment-variables-reference)
2. [Option A — Local Development (No Docker)](#2-option-a--local-development-no-docker)
3. [Option B — Docker Compose (All-in-One Local Stack)](#3-option-b--docker-compose-all-in-one-local-stack)
4. [Option C — Cloud Deployment (Render + Vercel + MongoDB Atlas)](#4-option-c--cloud-deployment-render--vercel--mongodb-atlas)
5. [CI/CD Pipeline (GitHub Actions)](#5-cicd-pipeline-github-actions)
6. [Post-Deployment Checklist](#6-post-deployment-checklist)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Port the Express server listens on |
| `MONGO_URI` | **Yes** | `mongodb://localhost:27017/intellmeet` | MongoDB connection string |
| `JWT_SECRET` | **Yes** | *(none)* | Secret key for signing JWT tokens — use a long random string in production |
| `NODE_ENV` | No | `development` | Set to `production` in live deployments |
| `OPENAI_API_KEY` | No | *(empty)* | OpenAI API key for AI summaries. If blank, mock summaries are used automatically |
| `GOOGLE_CLIENT_ID` | No | *(empty)* | Google OAuth Client ID for authenticating users via Google login |

**Example `backend/.env` for production:**
```env
PORT=5000
MONGO_URI=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/intellmeet?retryWrites=true&w=majority
JWT_SECRET=xK9#mP2$vL7qR4nW8zY1tA6bF3cE5hJ0
NODE_ENV=production
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_CLIENT_ID=1234567890-xxxxxxxxxx.apps.googleusercontent.com
```

> [!CAUTION]
> Never commit `.env` files to Git. They are already added to `.gitignore`. Use the hosting platform's environment variable manager for production.

---

### Frontend (`frontend/.env.local` or environment variables)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | **Yes** | `http://localhost:5000/api` | Base HTTP URL for the backend API server |
| `VITE_SOCKET_URL` | **Yes** | `http://localhost:5000` | Socket.io server connection URL |
| `VITE_GOOGLE_CLIENT_ID` | **Yes** | *(empty)* | Google OAuth Client ID for frontend button rendering |

**Example `frontend/.env.local` for production:**
```env
VITE_API_URL=https://intellmeet-api.onrender.com/api
VITE_SOCKET_URL=https://intellmeet-api.onrender.com
VITE_GOOGLE_CLIENT_ID=1234567890-xxxxxxxxxx.apps.googleusercontent.com
```

---

## 2. Option A — Local Development (No Docker)

### Prerequisites
- Node.js v20+ installed
- MongoDB Community Server installed and running locally on `mongodb://localhost:27017`

### Step 1: Set Up Backend
1. Open a terminal and navigate to the backend:
   ```bash
   cd backend
   ```
2. Create your `.env` file:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in `MONGO_URI`, `JWT_SECRET`, and `GOOGLE_CLIENT_ID`.
4. Install dependencies and start the backend:
   ```bash
   npm install
   npm run dev
   ```
   The backend should start on `http://localhost:5000`.

### Step 2: Set Up Frontend
1. Open a new terminal and navigate to the frontend:
   ```bash
   cd frontend
   ```
2. Create your `.env.local` file:
   ```bash
   cp .env.example .env.local
   ```
3. Set the environment variables:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
   ```
4. Install dependencies and start the Vite dev server:
   ```bash
   npm install
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`.

---

## 3. Option B — Docker Compose (All-in-One Local Stack)

Ensure Docker Desktop is installed and running.

1. Open your terminal at the project root directory.
2. Build and launch the entire stack:
   ```bash
   docker-compose up --build
   ```
3. This command will pull the MongoDB image, build the backend and frontend Docker containers, hook them up on the `intellmeet-network` bridge, and launch everything.
4. Services will be available as follows:
   - **Frontend UI:** `http://localhost:5173`
   - **Backend API:** `http://localhost:5000`
   - **Local Database:** `localhost:27017`

To shut down the containers and preserve the database volume, run:
```bash
docker-compose down
```

---

## 4. Option C — Cloud Deployment (Render + Vercel + MongoDB Atlas)

### Step 1: Set Up MongoDB Atlas
1. Go to [MongoDB Atlas](https://cloud.mongodb.com) and create a free account.
2. Build a new database cluster (choose the free **M0 Tier**).
3. Under **Network Access**, add a rule to allow connections from anywhere (`0.0.0.0/0`) since Render's outgoing IPs change dynamically.
4. Under **Database Access**, create a user (e.g., `intellmeet_db_user`) with read/write permissions and copy the password.
5. In the cluster overview, click **Connect** → **Drivers** and copy your connection string.
6. Replace `<password>` with your database user's password and insert `intellmeet` between the `/` and `?` in the connection string:
   `mongodb+srv://intellmeet_db_user:<password>@cluster0.xxxxx.mongodb.net/intellmeet?retryWrites=true&w=majority`

### Step 2: Deploy Backend to Render
1. Go to [Render](https://render.com) and register/login with GitHub.
2. Click **New +** → **Web Service** and choose **Build and deploy from a Git repository**.
3. Grant access to your `intellmeet` repository and connect it.
4. Configure the web service with:
   - **Name:** `intellmeet-api`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
5. Click **Advanced** or navigate to **Environment** tab, then add:
   - `PORT` = `5000`
   - `MONGO_URI` = *(your Atlas connection string)*
   - `JWT_SECRET` = *(a secure random string)*
   - `NODE_ENV` = `production`
   - `GOOGLE_CLIENT_ID` = *(your Google Client ID)*
   - `OPENAI_API_KEY` = *(optional)*
6. Deploy the web service. Note the service URL (e.g., `https://intellmeet-api.onrender.com`).

### Step 3: Deploy Frontend to Vercel
1. Go to [Vercel](https://vercel.com) and login with GitHub.
2. Click **Add New** → **Project** and import your `intellmeet` repository.
3. Configure the project parameters:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add the following **Environment Variables** in Vercel:
   - `VITE_API_URL` = `https://intellmeet-api.onrender.com/api`
   - `VITE_SOCKET_URL` = `https://intellmeet-api.onrender.com`
   - `VITE_GOOGLE_CLIENT_ID` = *(your Google Client ID)*
5. Click **Deploy**. Vercel will build and serve your frontend.

---

## 5. CI/CD Pipeline (GitHub Actions)

An automated CI/CD pipeline is configured in `.github/workflows/ci.yml`. On every push to `main` or `master`, the workflow will:
1. **Parallel Lint & Build (CI):** Install dependencies and build the frontend (TypeScript verification) while checking the backend file syntax in parallel.
2. **Backend Redeploy (CD):** Trigger a deploy hook on Render to automatically fetch the latest code and spin up the new backend version.
3. **Frontend Redeploy (CD):** Authenticate with Vercel and build & deploy the frontend production files to the Vercel CDN.

### Setting Up Secrets in GitHub
To allow the GitHub Actions runner to trigger Render and deploy to Vercel, navigate to your repository on GitHub → **Settings** → **Secrets and variables** → **Actions** and add these Secrets:

| Secret Name | Description | Source |
|-------------|-------------|--------|
| `RENDER_DEPLOY_HOOK_URL` | Deploy Hook URL that triggers Render backend build | Render → Web Service → Settings → Deploy Hook URL |
| `VERCEL_TOKEN` | Authentication Token to permit deployment commands | Vercel → Account Settings → Tokens (Create Personal Token) |
| `VERCEL_ORG_ID` | Identifies your Vercel organization | Run `npx vercel link` in `frontend/`, see `.vercel/project.json` -> `orgId` |
| `VERCEL_PROJECT_ID` | Identifies your Vercel project | Run `npx vercel link` in `frontend/`, see `.vercel/project.json` -> `projectId` |

---

## 6. Post-Deployment Checklist
- [ ] Connect your MongoDB Atlas database and verify that registration/login works.
- [ ] Try creating a meeting room, joining as a separate participant, and verifying WebRTC video/audio and Chat functionality.
- [ ] End the meeting as host and verify that the AI pipeline executes and tasks are added to the Kanban dashboard.
- [ ] Confirm all environment variables are correctly populated in production consoles.

---

## 7. Troubleshooting

### WebRTC Connection Issues (No Video/Audio)
- **Localhost vs HTTP/HTTPS:** Browsers block media devices (`getUserMedia`) on unencrypted HTTP connections. Make sure you access the deployed site via `https://` (which Vercel provides by default).
- **CORS/Socket Issues:** Verify that the frontend `VITE_API_URL` and `VITE_SOCKET_URL` point correctly to the backend HTTPS address (and contain no trailing slashes in path checks).

### Render Server Sleeping (Free Tier)
- Render Free Tier puts web services to sleep after 15 minutes of inactivity. The first API request might take 50-60 seconds to spin the container back up. The CI/CD pipeline health checker handles this by polling the endpoint up to 5 times.

### Vercel CLI Token Issues
- If Vercel deployments fail with `Invalid Token`, regenerate a token in Vercel settings and update the `VERCEL_TOKEN` secret in GitHub.
