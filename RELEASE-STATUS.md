# ARRAKIS Volunteer Beta — Release Status

## Included in this deployment-prep package

- Sandbox-only main frontend; no active import of Hyperliquid wallet/testnet component. Its source is archived under `optional-integrations/` for later.
- Configurable API base URL so the production Vercel build can call the separately hosted Render backend rather than `localhost`.
- Optional invite-code prompt in the frontend, with server-side verification and an API header gate when `ARRAKIS_BETA_ACCESS_CODE` is configured.
- Production Express build/start scripts, Node runtime declaration, Render health check and Vercel static deployment configuration.
- Example environment files, safer Git ignore patterns, and a remote-capable API smoke test.

## Not claimed complete

- This package has not been deployed to GitHub, Vercel, or Render from this environment. The user must authorize/connect their own accounts and set the environment variables.
- Full Vite production build and backend TypeScript compilation could not be run in this packaging environment because dependency installation timed out. They must be confirmed by the user or hosting build logs.
- No server-side tester registry, persistent simulated account ledger, admin monitoring console, wallet linking, or future airdrop eligibility workflow is implemented. The sandbox state remains browser-local.
- The free Render blueprint uses `/tmp/arrakis-data`; backend SQLite history is ephemeral and may reset on restart/redeploy.
- The shared beta code is only an invite barrier, not individual authentication. Do not store or transact real funds through this release.

## Launch classification

Prepared for a limited volunteer sandbox beta after deployment checks pass. Not a financial exchange, not a custody service, and not an on-chain trading product.
