# ARRAKIS Sandbox Beta

ARRAKIS is a simulated trading workspace with market reference data and a read-only AI Analyst. Simulated token balances and trade history live in each tester’s browser; no real funds, wallet connection, smart contracts, or on-chain orders are used in this release.

## Local development

- Frontend: `npm install` then `npm run dev`.
- Backend: from another terminal run `npm run server` at the project root.
- Backend checks: `npm run test:api`.
- Production frontend build: `npm run build`.
- Backend TypeScript check: `npm run typecheck:server`.

Copy `server/.env.example` to `server/.env` for local AI setup. Keep keys server-side and never commit `.env` files.

## Volunteer beta deployment

See [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md). The frontend is prepared for Vercel; the Express API is prepared for Render via `vercel.json` and `render.yaml`. A shared access code can gate the volunteer beta. The shared code is a lightweight barrier, not per-user authentication.

## Current limitations

- The browser-local sandbox is not a central, server-authoritative ledger. A tester’s activity is not automatically visible in an admin dashboard.
- The backend’s SQLite market/risk history is ephemeral on the included free Render configuration; it can reset on restart/redeploy.
- The AI Analyst is read-only and does not execute orders.
- A tester registry, wallet verification, cross-device accounts, admin dashboard, airdrop eligibility tracking, and live external venue execution are future work.
