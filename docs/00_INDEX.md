# IntellMeet — Documentation Index

A complete, beginner-friendly guide to every file and concept in the IntellMeet codebase.
Each document below explains exactly **what a file does**, **why it exists**, and **how it works**, line by line.

---

## 📁 Backend Documentation

### Server Entry Point

| # | File | What It Covers |
|---|------|---------------|
| [14](./14_server_entry_point_explanation.md) | `server.js` | Full startup sequence: Express, Socket.io, helmet, rate limiting, MongoDB connection |

### Controllers (API Request Handlers)

| # | File | What It Covers |
|---|------|---------------|
| [08](./08_auth_controller_explanation.md) | `authController.js` | User registration, login, JWT token generation, profile fetching |
| [09](./09_task_controller_explanation.md) | `taskController.js` | Create, list, update status, and delete Kanban tasks |
| [10](./10_meeting_controller_explanation.md) | `meetingController.js` | Full meeting lifecycle: create, list, access control, end meeting + AI pipeline |

### Services & Middleware

| # | File | What It Covers |
|---|------|---------------|
| [07](./07_auth_middleware_explanation.md) | `authMiddleware.js` | JWT validation, `protect`, `optionalProtect`, and route access control |
| [11](./11_ai_service_explanation.md) | `aiService.js` | OpenAI integration, prompt templates, JSON mode, and mock fallback |
| [12](./12_meeting_socket_explanation.md) | `meetingSocket.js` | Socket.io rooms, live chat, join/leave events, WebRTC signaling relay |

### Database Models & Routing

| # | File | What It Covers |
|---|------|---------------|
| [13](./13_models_explanation.md) | `userModel / meetingModel / taskModel` | Mongoose schemas, indexes, password hashing, and model references |
| [15](./15_routes_explanation.md) | `authRoutes / meetingRoutes / taskRoutes` | API route definitions and mounting |

---

## 📁 Frontend Documentation

### State Management & Server Synchronization

| # | File | What It Covers |
|---|------|---------------|
| [01](./01_react_query_meetings.md) | `useMeetings.ts` | React Query hooks for fetching, creating, and deleting meetings |
| [02](./02_react_query_tasks.md) | `useTasks.ts` | React Query hooks for fetching, creating, and updating task status |
| [16](./16_api_client_and_auth_store.md) | `api.ts / authStore.ts` | Axios config, interceptors, and Zustand client authentication state |

### Pages & Layout

| # | File | What It Covers |
|---|------|---------------|
| [17](./17_main_and_app_explanation.md) | `main.tsx / App.tsx` | Router setup, routes structure, React Query client provider |
| [19](./19_auth_page_explanation.md) | `AuthPage.tsx` | UI layouts, toggle states, forms validation, API login/register handling |
| [20](./20_tasks_board_and_modals_explanation.md) | `TasksBoard.tsx / CreateTaskModal.tsx` | Kanban task columns, drag-drop mockups, and state synchronization |
| [22](./22_meeting_room_page_explanation.md) | `MeetingRoomPage.tsx` | Complete WebRTC + Socket lifecycle, track swapping, and chat drawers |

### UI Components & Charts

| # | File | What It Covers |
|---|------|---------------|
| [18](./18_meeting_and_task_card_explanation.md) | `MeetingCard.tsx / TaskCard.tsx` | User initials generator helper, status cards, and layout blocks |
| [21](./21_analytics_explanation.md) | `Analytics.tsx` | Custom SVG charts, calculations, and TanStack React Query statistics |

---

## 📁 DevOps & Deployment Documentation

| # | File | What It Covers |
|---|------|---------------|
| [05](./05_ci_cd_workflow.md) | `.github/workflows/ci.yml` | GitHub Actions CI/CD pipeline for frontend and backend validation |
| [06](./06_docker_containerization.md) | `Dockerfile / docker-compose.yml` | Multi-stage Docker files and Docker Compose local environment |
| [23](./23_github_cicd_deployment.md) | `docs/23_github_cicd_deployment.md` | Automated deployment guides for Render, Vercel, and GitHub Secrets |

---

## 🔑 Key Concepts Glossary

| Term | Simple Explanation |
|------|--------------------|
| **JWT (JSON Web Token)** | A signed token proving identity, used as a digital passport. |
| **Middleware** | Intercepting code that runs between a request arriving and the controller handling it. |
| **Socket.io Room** | A real-time virtual room ensuring messages are shared only among specific participants. |
| **WebRTC (Real-Time Communication)** | Browser technology enabling direct peer-to-peer video/audio streams. |
| **STUN Server** | A server used to discover public IP addresses behind NAT/firewalls for WebRTC connections. |
| **ICE Candidate** | A connection candidate (IP/port) representing a path through which peers can communicate. |
| **SDP (Session Description Protocol) Offer/Answer** | Metadata payload describing media tracks, formats, and network capabilities to initiate peer connections. |
| **React Query** | Data-fetching library that caches, invalidates, and synchronizes server state automatically. |
| **Zustand** | Light, fast state store used for managing local client-side state (like auth credentials). |
| **`useRef`** | React hook holding a mutable value that persists across renders without triggering a re-render. |
| **`useMemo`** | React hook that memoizes expensive computations, recalculating only when dependencies change. |
| **`srcObject`** | HTMLMediaElement property used to assign a WebRTC `MediaStream` directly to a `<video>` tag. |
| **Populate** | Mongoose operator replacing database ID references with the actual document values. |
