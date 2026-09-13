# Support Operations Console
 
A full-stack AI-powered support operations console for an e-commerce store. An AI agent processes customer support requests and either executes actions autonomously or escalates them to a human reviewer.
 
## Live Demo
 
| Service | URL |
|---|---|
| Frontend | https://support-ops-console.vercel.app |
| Backend API | https://support-ops-console-production.up.railway.app |
| Health Check | https://support-ops-console-production.up.railway.app/health |


 ## Stack
 
**Backend:** Node.js + Express + TypeScript, Drizzle ORM, PostgreSQL, OpenAI gpt-4o-mini, Winston, Zod, express-rate-limit
 
**Frontend:** React + TypeScript + Tailwind + Vite
 
**Deployment:** Railway (backend + PostgreSQL), Vercel (frontend)

## Local Setup
 
### Prerequisites
- Node.js 20+
- PostgreSQL - railway link
- OpenAI API key

- ### 1. Clone the repo
 
```bash
git clone https://github.com/zee-18/support-ops-console.git
cd support-ops-console
```
 
### 2. Backend setup
 
```bash
cd backend
cp .env.example .env
```
 
Fill in `.env`:
 
```env
DATABASE_URL=your_db_public_url
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
```


Install dependencies and run migrations:
 
```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```
 
Backend runs at `http://localhost:3001`


### 3. Frontend setup
 
```bash
cd frontend
cp .env
```
 
`.env` should be empty for local dev (Vite proxy handles API calls):
 
```env
VITE_API_URL=
```
 
Install and run:
 
```bash
npm install
npm run dev
```
 
Frontend runs at `http://localhost:5173`
 
---

## Seed Data

| Order ID | Status | Refunded | Customer | Test Scenario |
|---|---|---|---|---|
| ORD-001 | delivered | false | 1 | Normal refund → escalates |
| ORD-002 | delivered | true | 1 | Already refunded guardrail |
| ORD-003 | pending | false | 1 | Auto-cancel |
| ORD-004 | shipped | false | 1 | Cannot cancel → escalates |
| ORD-005 | delivered | false | 2 | Wrong customer guardrail |
| ORD-006 | delivered | false | 1 | Concurrent refund test |
| ORD-007 | processing | false | 1 | Auto-cancel |
| ORD-008 | delivered | false | 1 | Concurrent approval test |

