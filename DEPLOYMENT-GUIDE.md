# ARRAKIS volunteer beta deployment

This release deploys the existing sandbox-only trading interface as a static Vite site on Vercel and its read-only analysis/market API as an Express service on Render.

## What this beta is (and is not)

- Per-browser simulated balances, positions, orders, and history. The backend does **not** receive a central copy of every tester's simulated trades yet.
- Read-only market/risk data and the AI Analyst. There is no wallet connection, smart-contract settlement, or real-money order execution.
- A shared access-code gate helps limit access to a volunteer cohort. It is **not** per-user authentication; users can inspect client-side requests after they enter the code. Do not use this gate to protect real funds or confidential information.
- The Render blueprint uses the free plan and stores the small SQLite market/risk history under `/tmp/arrakis-data`. That filesystem is ephemeral, so backend history can reset after restarts or redeploys. The sandbox user's account is still local to their browser. Persistent tester registry and airdrop eligibility are future work.

## 1. Prepare the repository safely

1. Extract this project so `package.json`, `render.yaml`, `vercel.json`, `src/`, and `server/` are at the repository root (not nested inside another `perp-aggregator/` directory).
2. Never commit `.env`, any API key, private key, `server/data/`, SQLite database files, or any backup/log file containing secrets. The included `.gitignore` excludes the normal secret and runtime-data paths; review `git status` before committing.
3. Create an **empty private GitHub repository**.
4. In PowerShell, open a terminal in this extracted project folder, then run:

   ```powershell
   git init
   git add .
   git status
   git commit -m "Prepare ARRAKIS volunteer beta"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

   Replace the remote URL with the repository URL shown by GitHub. Confirm `git status` does not list `.env`, databases, or keys before you commit. If Git prompts for authentication, follow GitHub's sign-in flow; never paste a personal access token into chat.

## 2. Deploy the backend to Render

1. Sign in to Render and choose **New → Blueprint** (sometimes labelled Infrastructure as Code), then connect the private GitHub repository.
2. Render reads `render.yaml` and creates the `arrakis-api` web service from the `server/` directory.
3. Provide these environment variables when prompted or in the service's **Environment** screen:
   - `GEMINI_API_KEY`: the Gemini key, added only in Render's secret environment-variable UI.
   - `ARRAKIS_BETA_ACCESS_CODE`: a strong random invite code to share privately with testers.
   - `CORS_ORIGINS`: set temporarily to `https://arrakis-sandbox.vercel.app`, then replace it with the exact real Vercel site origin after step 3. Use origins only (scheme + hostname), no path or trailing slash.
   - `ARRAKIS_AI_PROVIDER` should be `gemini`; `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite` in the Blueprint.
4. A random code can be generated in PowerShell with:

   ```powershell
   [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
   ```

   Save it in a password manager and share it with volunteers separately from the public URL. Do not put it in GitHub, `vercel.json`, source files, or a `VITE_*` variable.
5. Wait for the deploy to finish, then open `https://YOUR-RENDER-SERVICE.onrender.com/health`. It should return JSON with `status: "ok"`.

The service is on Render's free plan; expect cold starts after idle time. This plan does not mount a persistent disk, so `/tmp/arrakis-data` is temporary. If persistent server history is required, move to a paid persistent disk or a managed database before relying on it.

## 3. Deploy the frontend to Vercel

1. In Vercel, choose **Add New → Project**, import the GitHub repository, and use the repository root as the project root.
2. Confirm the Vite framework settings: install `npm ci`, build `npm run build`, output directory `dist`.
3. Add these **environment variables** in Vercel (Production, and Preview only if you want preview deployments to require the same invite gate):
   - `VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com`
   - `VITE_REQUIRE_BETA_ACCESS=true`
4. Deploy. Copy the exact production origin from Vercel (for example `https://arrakis-sandbox.vercel.app`).
5. Return to Render → `arrakis-api` → Environment. Set `CORS_ORIGINS` to that exact origin, save, and redeploy. The frontend will need a new deployment only if you change its own Vercel environment variables.

`VITE_*` values are bundled into the browser application. Never place provider API keys, wallet secrets, or any confidential credential in them.

## 4. Invite and verify volunteer testers

1. Open the Vercel site in a private/incognito browser.
2. Enter the beta code. Confirm the dashboard loads and market references appear.
3. Visit **Intelligence** and ask for a market comparison or hypothetical risk assessment. Check for an actual response, not only a green status badge.
4. Claim test funds, open and close a small simulated position, and confirm the balance and history update.
5. Check the Render service logs for unexpected errors. The API's `/health` endpoint should remain available.
6. Send volunteers the Vercel URL and beta code separately.

The shared beta code is a lightweight invite barrier, not real account authentication. The frontend's simulated account is stored in each person's browser. An admin console, cross-device accounts, server-side user identities, tester activity aggregation, wallet linking/verification, and future airdrop eligibility are **not** implemented in this release.

## 5. API smoke check

The included smoke test can also check the deployed API. In PowerShell:

```powershell
$env:ARRAKIS_API_BASE_URL = "https://YOUR-RENDER-SERVICE.onrender.com"
$env:ARRAKIS_BETA_ACCESS_CODE = "PASTE-YOUR-BETA-CODE-HERE"
npm run test:api
Remove-Item Env:ARRAKIS_API_BASE_URL
Remove-Item Env:ARRAKIS_BETA_ACCESS_CODE
```

This checks API endpoints only. It does not place orders, test an actual external exchange, prove AI answer quality, or verify multi-user account persistence.

## Troubleshooting

- **CORS/network error in the browser:** set `CORS_ORIGINS` on Render to the exact Vercel origin, then redeploy.
- **“Beta access is not configured”:** set `ARRAKIS_BETA_ACCESS_CODE` in Render and redeploy.
- **AI not configured:** check `ARRAKIS_AI_PROVIDER=gemini` and `GEMINI_API_KEY` in Render; never put the key on Vercel.
- **Frontend tries localhost:** set `VITE_API_BASE_URL` in Vercel and redeploy because Vite embeds environment variables at build time.
- **First API request is slow:** Render free services may have a cold start after idle time.
