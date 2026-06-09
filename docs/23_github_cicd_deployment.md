# IntellMeet — GitHub CI/CD Deployment Guide

Complete step-by-step guide to set up automated deployment from GitHub to **Render** (backend) and **Vercel** (frontend) using GitHub Actions.

Every time you push to `main` or `master`, GitHub will automatically:
1. ✅ Run tests and build checks
2. 🚀 Deploy the backend to Render
3. 🚀 Deploy the frontend to Vercel

---

## 📋 Prerequisites

Before starting, make sure you have:
- [ ] Code pushed to GitHub (`https://github.com/<your-username>/intellmeet`)
- [ ] A [Render.com](https://render.com) account (free)
- [ ] A [Vercel.com](https://vercel.com) account (free)
- [ ] A [MongoDB Atlas](https://cloud.mongodb.com) account (free)
- [ ] A [Google Cloud Console](https://console.cloud.google.com) project (for Google Auth credentials)

---

## 🗺️ Overview — How the Pipeline Works

```
You push code to GitHub (main branch)
            │
            ▼
┌─────────────────────────────────────────────┐
│           GitHub Actions Workflow            │
│                                             │
│  Job 1: CI (Build & Validate)               │
│    ├── Install frontend deps                │
│    ├── Build Vite (TypeScript check)        │
│    ├── Install backend deps                 │
│    └── Syntax check backend files           │
│                                             │
│  Job 2: Deploy Backend (needs: ci)          │
│    └── Trigger Render Deploy Hook URL       │
│         → Render pulls new code & restarts  │
│                                             │
│  Job 3: Deploy Frontend (needs: ci)         │
│    └── Run Vercel CLI deploy command        │
│         → Vercel builds & publishes to CDN  │
└─────────────────────────────────────────────┘
```

> **Important:** Deploy jobs only run if the CI job **passes**. Broken code is never deployed.

---

## PART 1 — Set Up MongoDB Atlas (Database)

### Step 1: Create Free Cluster
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and sign in.
2. Click **Create** → Choose **M0 Free** tier → Select a region → Click **Create Deployment**.
3. When prompted, create a **database user**:
   - Username: `intellmeet_user`
   - Password: Click **Autogenerate** and copy the password.
4. Click **Create User**.

### Step 2: Allow Network Access
1. In the left sidebar, click **Network Access**.
2. Click **Add IP Address**.
3. Click **Allow Access from Anywhere** → This sets `0.0.0.0/0`.
4. Click **Confirm**.

### Step 3: Get Your Connection String
1. Click **Connect** → **Drivers**.
2. Copy the connection string.
3. Replace `<password>` with the password you copied in Step 1.
4. Add the database name — insert `intellmeet` between the `/` and `?` in the connection string:
   `mongodb+srv://intellmeet_user:YOURPASSWORD@cluster0.xxxxx.mongodb.net/intellmeet?retryWrites=true&w=majority`
5. **Save this string** — you'll need it in the next step.

---

## PART 2 — Deploy Backend on Render

### Step 1: Create a Web Service
1. Go to [render.com](https://render.com) and sign in with GitHub.
2. Click **New +** → **Web Service**.
3. Click **Connect** next to your `intellmeet` repository.
4. Configure the service:
   - **Name:** `intellmeet-api`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
5. Click **Create Web Service**.

### Step 2: Add Environment Variables on Render
After creation, go to your service → **Environment** tab → Add these:
- `PORT` = `5000`
- `MONGO_URI` = *(your Atlas connection string)*
- `JWT_SECRET` = *(generate a random string)*
- `NODE_ENV` = `production`
- `GOOGLE_CLIENT_ID` = *(your Google client ID)*
- `OPENAI_API_KEY` = *(your OpenAI API key, optional)*

### Step 3: Get the Render Deploy Hook URL
1. In your Render service, go to **Settings** tab.
2. Scroll down to **Deploy Hook**.
3. Click **Generate Deploy Hook**.
4. Copy the URL (looks like: `https://api.render.com/deploy/srv-xxxxx?key=xxxxx`).
5. **Save this URL** — you will add it to GitHub Secrets.

---

## PART 3 — Deploy Frontend on Vercel

### Step 1: Import Project
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New** → **Project**.
3. Find and click **Import** next to your `intellmeet` repository.
4. Configure:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Before clicking Deploy, add **Environment Variables**:
   - `VITE_API_URL` = `https://intellmeet-api.onrender.com/api`
   - `VITE_SOCKET_URL` = `https://intellmeet-api.onrender.com`
   - `VITE_GOOGLE_CLIENT_ID` = *(your Google client ID)*
6. Click **Deploy** to do the first manual deployment.

### Step 2: Get Vercel Credentials for GitHub Actions
You need 3 values from Vercel for the CI/CD pipeline:
- **`VERCEL_TOKEN`**: Go to [vercel.com/account/tokens](https://vercel.com/account/tokens) → Click **Create** → Name it `github-actions-intellmeet` → Copy the token.
- **`VERCEL_ORG_ID`** & **`VERCEL_PROJECT_ID`**: In the terminal, run `npx vercel link` in the `frontend/` folder, follow the prompts, and copy `orgId` and `projectId` from `frontend/.vercel/project.json`.

---

## PART 4 — Add Secrets to GitHub

All sensitive values must be stored as **GitHub Secrets** — never in code.
1. Go to your GitHub repository: `https://github.com/<your-username>/intellmeet`
2. Click **Settings** tab (top of the page).
3. In the left sidebar, click **Secrets and variables** → **Actions**.
4. Click **New repository secret** for each item below:
   - `RENDER_DEPLOY_HOOK_URL`
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

---

## PART 5 — Push and Test the Pipeline

Commit all your local changes and push them to the main branch:
```bash
git add .
git commit -m "feat: integrate Google Authentication and Mobile Responsiveness"
git push origin main
```
Go to your GitHub repo → **Actions** tab to watch the automated CI/CD pipeline compile and deploy your updates!
