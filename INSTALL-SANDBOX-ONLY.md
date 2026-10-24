# Install the ARRAKIS sandbox-only release

This release shows the local ARRAKIS simulated exchange as the only trading mode. Hyperliquid wallet/testnet execution is archived under `optional-integrations/hyperliquid-testnet/` and is not imported by the active UI.

## Apply to your existing development project

1. Stop the frontend and backend terminals with `Ctrl+C`.
2. Back up your current `perp-aggregator` folder.
3. Extract this ZIP to a temporary folder.
4. Copy the extracted project files into your existing `C:\Users\johnc\perp-aggregator` folder and choose **Replace files** when Windows asks.
5. Keep your existing `server/.env` and local `server/data` files. The ZIP does not contain either one.
6. Delete `src/HyperliquidTestnet.jsx` from the active project if it remains from the previous release. The archived copy in `optional-integrations/hyperliquid-testnet/` is retained for a future deliberate integration.
7. In the project root, run:

```bash
npm install
npm run build
```

8. If the build passes, start the backend and frontend as usual. Check that Trade shows only the ARRAKIS sandbox and Intelligence no longer displays Hyperliquid Testnet account or execution controls.

## What remains unchanged

- The same browser storage key is retained for the sandbox account so existing local demo balances, positions, orders and history are not intentionally reset.
- Demo token balances and trades remain browser-local simulated state.
- Public market quotes are references only; they are not proof of executable perpetual liquidity or fills.
- ARRAKIS Analyst is read-only. It may use read-only market/risk analysis tools, but cannot place orders.

## Deferred

A real Hyperliquid Testnet mode can be restored later as an explicit separate integration after its dependencies, wallet signatures, order state, rejection/partial-fill behavior, cancellation and testnet-only restrictions are tested end-to-end.
