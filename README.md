# TalentFlow – Mini Hiring Platform (Frontend Only)

A React (Next.js 15 + TypeScript + shadcn/ui) application that simulates a small hiring platform with Jobs, Candidates, and Assessments – all without a real backend. MirageJS provides a mock REST API and Dexie (IndexedDB) persists data locally so state survives refreshes.

## Tech Stack
- Next.js App Router (React 18)
- TypeScript
- Tailwind CSS + shadcn/ui components
- MirageJS for API mocking (with latency + error rates)
- Dexie (IndexedDB) for local persistence and seeding
- Faker for realistic seeds

## Features
- Jobs
  - Paginated, filterable jobs board (title, status, tags)
  - Create/Edit in modal (title required, unique slug), archive/unarchive
  - Drag-and-drop reordering with optimistic update and rollback on failure
  - Deep-link job details at `/jobs/:jobId`
- Candidates
  - Virtualized 1,000+ candidates list with client search and server-like filter (stage)
  - Candidate profile `/candidates/:id` with timeline of stage changes and notes
  - Simple Kanban (drag candidates between stages) with optimistic updates
  - Notes with @mentions suggestions (local list; plain text rendering)
- Assessments
  - Per-job assessment builder (sections + multiple question types)
  - Live preview form with validation (required, numeric range, max length)
  - Conditional visibility (show Q if other Q equals value)
  - Save builder and submit candidate responses – all local

## Getting Started
1. Install dependencies
   - npm: `npm install`
   - bun: `bun install`
2. Run the dev server
   - npm: `npm run dev`
   - bun: `bun dev`
3. Open http://localhost:3000

On first load, the app seeds:
- 25 jobs (active/archived, with tags and sort order)
- 1,000 candidates across stages and jobs
- 3 assessments with 10+ questions each

All data is stored in IndexedDB (`talentflow` database). MirageJS simulates requests with latency (200–1200ms). Write endpoints have a small failure rate to test optimistic updates.

## Project Structure
- `src/lib/db.ts` — Dexie schema, seeders, types, and utilities
- `src/mirage/server.ts` — MirageJS server and routes
- `src/app/providers.tsx` — Starts Mirage and ensures seed client-side
- `src/app/*` — App Router pages (Jobs, Candidates, Assessments)
- `src/components/ui/*` — shadcn/ui components

## Mock API
- GET `/jobs?search=&status=&page=&pageSize=&sort=`
- POST `/jobs`
- PATCH `/jobs/:id`
- PATCH `/jobs/:id/reorder`
- GET `/candidates?search=&stage=&page=&pageSize=`
- POST `/candidates`
- PATCH `/candidates/:id`
- GET `/candidates/:id/timeline`
- POST `/candidates/:id/notes`
- GET `/assessments/:jobId`
- PUT `/assessments/:jobId`
- POST `/assessments/:jobId/submit`

Notes
- Latency injected on all endpoints (200–1200ms)
- Write endpoints randomly fail (5–10%) to test rollback flows
- All persistence is local via Dexie; Mirage just proxies to IndexedDB

## Key UX Details
- Jobs: optimistic reorder with server rollback; archive/unarchive toggles
- Candidates: list view with simple virtualization; Kanban uses HTML5 drag-and-drop
- Candidate profile: notes box supports typing `@` to show suggestions from a local list; select to insert handle
- Assessments: builder state saved via PUT; preview form validates and submits to local store

## Development Notes
- This is a frontend-only demo. There is no real backend.
- If you need to reset the data, clear browser storage for the site (IndexedDB) and reload.

## Deployment
You can deploy to Vercel (or any platform that serves Next.js). Since we rely on `window` to boot Mirage, SSR works and the mock server starts only in the browser.

## License
MIT