# IntellMeet – AI-Powered Enterprise Meeting & Collaboration Platform

> **Production-Grade Full-Stack MERN Application with Real-Time Video, AI Meeting Intelligence & Team Collaboration**

**Prepared For:** Zidio Development – Web Development (MERN) Domain  
**Author:** Pavan Kumar  
**Date:** March 2026  
**Version:** 2.0 – Industry Edition

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

---

## 3. Technology Stack

| Category | Technology | Rationale / Alternatives |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Vite | Fast HMR, excellent developer experience |
| **State Management** | Zustand | Lightweight client-state management |
| **Backend** | Node.js + Express | Fast, scalable event-driven architecture |
| **Database** | MongoDB + Mongoose | Flexible NoSQL schema for unstructured meeting data |
| **Real-Time** | Socket.io + WebRTC | Bidirectional real-time communication |
| **AI Integration** | OpenAI API | Industry-leading text summarization |
| **Security** | Helmet + Express Rate Limit | OWASP Top 10 mitigation |

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

---

## 6. Setup & Installation (Local Development)

### Prerequisites
*   Node.js (v18+)
*   MongoDB running locally (`mongodb://localhost:27017/intellmeet`)
*   OpenAI API Key (Optional, for AI summaries)

### Step 1: Start the Backend
1. Open a terminal and navigate to the backend folder: `cd backend`
2. Install dependencies: `npm install`
3. Start the server: `npm start` *(Runs on port 5000)*

### Step 2: Start the Frontend
1. Open a new terminal and navigate to the frontend folder: `cd frontend`
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev` *(Runs on port 5173/5174)*

Open `http://localhost:5173` in your browser to view the application.

---

## 7. Personal Reflection

Building IntellMeet was an incredible journey into full-stack engineering. The biggest challenge was perfectly syncing real-time state using Socket.io while maintaining a clean, decoupled architecture between the React frontend and Express backend. Implementing modern security practices (Helmet, Rate Limiting, JWT) provided hands-on experience with enterprise-grade application hardening. In the future, I plan to deploy this architecture using Docker and Kubernetes to fully realize the week-4 scalability goals.
