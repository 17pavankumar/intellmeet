# IntellMeet – AI-Powered Enterprise Meeting & Collaboration Platform

> **Production-Grade Full-Stack MERN Application with Real-Time Video, AI Meeting Intelligence & Team Collaboration**

<!-- **Prepared For:** Zidio Development – Web Development (MERN) Domain  
**Author:** Pavan Kumar  
**Date:** March 2026  
**Version:** 2.0 – Industry Edition -->

---

## 1. Project Overview

**Vision & Objectives**  
Meetings are the biggest time killer in enterprises. IntellMeet transforms meetings into productive experiences with real-time video, AI-powered summaries, smart action item extraction, and seamless collaboration. The goal is to reduce meeting follow-up time by 40–60%.

**Target Users & Use Cases**  
*   **Enterprise Teams:** Remote and hybrid teams needing a unified platform for daily standups, sprint planning, and client calls.
*   **Project Managers:** Automatically track meeting action items without manual note-taking.

**Business Value Delivered**  
*   Eliminates manual documentation via OpenAI-powered transcripts and summaries.
*   Keeps teams accountable with integrated Task Management (Kanban).
*   Centralizes communication, reducing tool fatigue.

**Non-Functional Goals**  
*   **Latency:** < 200 ms for real-time WebSocket events.
*   **Security:** JWT Authentication, BCrypt password hashing, and Helmet/Rate-Limiting for OWASP mitigation.
*   **Scalability:** Horizontal scaling support with Socket.io.

---

## 2. Key Features

| ID | Feature | Description | Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| **F-01** | User Auth & Profiles | Secure signup/login with JWT, password hashing | Password hashing, stateless auth |
| **F-02** | Real-Time Meetings | Video conferencing with screen sharing via WebRTC | Support multi-user rooms, low latency |
| **F-03** | AI Intelligence | Automatic summary generation & action item extraction | Accurate summaries using OpenAI |
| **F-04** | Real-Time Chat | In-meeting chat and real-time collaboration | Real-time sync across participants via Socket.io |
| **F-05** | Dashboard & Tasks | Post-meeting dashboard, task creation and management | Actionable task list, status tracking |
| **F-06** | Analytics Dashboard | Visual charts (bar/donut/progress) for meetings and tasks | SVG charts with no external chart library |
| **F-07** | Meeting Access Control | Hosts restrict meetings to invited emails only | Public/restricted toggle, invited email list |

---

## 3. Technology Stack

| Category | Technology | Rationale / Alternatives |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Vite | Fast HMR, excellent developer experience |
| **Server State** | TanStack React Query v5 | Automatic cache, background refetch, mutation invalidation |
| **Client State** | Zustand | Lightweight auth/UI state (not used for server data) |
| **Backend** | Node.js + Express | Fast, scalable event-driven architecture |
| **Database** | MongoDB + Mongoose | Flexible NoSQL schema for unstructured meeting data |
| **Real-Time** | Socket.io + WebRTC | Bidirectional real-time communication + P2P video |
| **AI Integration** | OpenAI API (GPT-4o-mini) | Industry-leading text summarization; mock fallback when key absent |
| **Security** | Helmet + Express Rate Limit | OWASP Top 10 mitigation |
| **DevOps** | GitHub Actions + Docker Compose | Automated CI pipeline + local container stack |

---

## 4. Architecture Overview

```text
[ Client (React + Vite) ]  <--->  [ Socket.io (Real-Time Chat) ]
          |                                     |
          v                                     v
[ REST API (Express) ]     <--->  [ AI Service (OpenAI API) ]
          |
          v
  [ MongoDB (Atlas) ]
```

---

## 5. Technical Highlights & Security

*   **OWASP Mitigation:** Implemented `helmet` to secure Express apps by setting various HTTP headers.
*   **Rate Limiting:** Added `express-rate-limit` to prevent brute-force attacks on the API.
*   **Authentication:** Stateless JWT (JSON Web Tokens) with `bcryptjs` for secure password hashing.
*   **Real-Time Data:** Utilized Socket.io rooms to segment meeting traffic, ensuring chat messages are only broadcast to users currently in that specific meeting room.
*   **Code Simplicity & Educational Design:** Core logic functions (like transcript creation, statistics filtering, and socket relay handlers) have been rewritten to avoid complex/compound expressions, chained operations, or destructuring rest/spread patterns. These have been replaced with explicit variables, simple `for` loops, and exhaustive line-by-line explanations directly inside the source files.

---

## 6. Setup & Installation (Local Development)

### Prerequisites
*   Node.js (v18+)
*   MongoDB running locally (`mongodb://localhost:27017/intellmeet`)
*   OpenAI API Key (Optional — only needed for AI meeting summaries)

### Step 1: Configure Backend Environment
1. Navigate to the backend folder: `cd backend`
2. Copy the example env file: `copy .env.example .env` (Windows) or `cp .env.example .env` (Mac/Linux)
3. Edit `backend/.env` and set your values:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/intellmeet
   JWT_SECRET=replace_with_a_long_random_string
   NODE_ENV=development
   OPENAI_API_KEY=sk-...   # Optional
   ```
4. Install dependencies: `npm install`
5. Start the server: `npm start` *(Runs on port 5000)*

### Step 2: Configure Frontend Environment
1. Navigate to the frontend folder: `cd frontend`
2. Copy the example env file: `copy .env.example .env.local` (Windows) or `cp .env.example .env.local` (Mac/Linux)
3. For local development the default values work — no edits needed.
   > For production deployment, set `VITE_API_URL` and `VITE_SOCKET_URL` to your deployed backend URL.
4. Install dependencies: `npm install`
5. Start the dev server: `npm run dev` *(Runs on port 5173)*

Open `http://localhost:5173` in your browser to view the application.

---

## 7. Key Features Added (Latest Updates)

| Feature | Description |
| :--- | :--- |
| **Meeting Access Control** | Hosts can restrict meetings to invited guests only via the ⋮ settings popover |
| **Copy Link (Fallback)** | Meeting link copy works on both HTTP and HTTPS via clipboard + textarea fallback |
| **Guest Lobby** | Unauthenticated users enter a name before joining; authenticated users skip directly in |
| **Instant Join After Create** | Creating a meeting now navigates you directly into the room |
| **WebRTC Name Relay** | Remote participant names and mute states now correctly sync across all peers |
| **AI Insights Modal** | Completed meetings show AI summary, action items, and full chat transcript |
| **Analytics Tab** | Visual SVG bar chart (meetings by day), donut chart (status breakdown), and task progress bar — built without any external chart library |
| **Code Simplification** | Core business logic, charts filtering, and WebRTC events rewritten into explicit loops/variables with line-by-line comments |

---

## 8. Documentation

Every file in the codebase has a dedicated beginner-friendly explanation in the [`docs/`](./docs/) folder.

| Quick Links | |
| :--- | :--- |
| 📖 [Full Documentation Index](./docs/00_INDEX.md) | Browse all 22 explanation documents |
| 🚀 [Deployment Guide](./DEPLOYMENT.md) | Local, Docker & Cloud (Render + Vercel + Atlas) |
| 🔒 [Auth Middleware](./docs/07_auth_middleware_explanation.md) | How JWT validation works |
| 🧠 [AI Service](./docs/11_ai_service_explanation.md) | OpenAI integration + mock fallback |
| 🔌 [Socket Signaling](./docs/12_meeting_socket_explanation.md) | WebRTC offer/answer relay |
| 📹 [Meeting Room Page](./docs/22_meeting_room_page_explanation.md) | Complete WebRTC + Socket lifecycle |
| 📊 [Analytics Component](./docs/21_analytics_explanation.md) | SVG charts + useMemo data processing |
| 🗄️ [MongoDB Models](./docs/13_models_explanation.md) | User, Meeting, Task schemas explained |

<!-- ## 7. Personal Reflection

Building IntellMeet was an incredible journey into full-stack engineering. The biggest challenge was perfectly syncing real-time state using Socket.io while maintaining a clean, decoupled architecture between the React frontend and Express backend. Implementing modern security practices (Helmet, Rate Limiting, JWT) provided hands-on experience with enterprise-grade application hardening. In the future, I plan to deploy this architecture using Docker and Kubernetes to fully realize the week-4 scalability goals. -->
