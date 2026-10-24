# ARRAKIS Simplified Release — Integration and Test Plan

## Product rule
The main interface has one trading mode: the ARRAKIS local simulated exchange. Do not show a Hyperliquid wallet/testnet mode, wallet connection or venue order submission in this release. The optional Hyperliquid component is archived outside `src/`.

## First install and build checks
From the project root, run:

```bash
npm install
npm run build
npm run typecheck:server
npm run test:api
```

## Manual trading checks
1. Claim demo funds; verify USDC, ETH, SOL and BNB balances update.
2. Place a market long and short; confirm simulated positions appear.
3. Place a limit order away from the current reference price; verify it stays pending.
4. Cancel a pending order; confirm reserved margin is released.
5. Close a position; verify balances and history update.
6. Test TP/SL behavior only in sandbox; verify the UI labels these as simulated triggers.
7. Execute a test-token swap; confirm conversion and fee accounting.
8. Reload the page and verify local sandbox data persists in the same browser.
9. Open Intelligence; check backend status and ask an actual question. Confirm the answer uses bounded account context and never claims to submit trades.

## Interpretation limits
The public spot candles/tickers are reference data, not futures fills or guarantees of executable depth. API smoke checks are not trading tests. Never present this release as a real exchange or an on-chain testnet trading interface.

## Deferred integration
The archived Hyperliquid component requires a deliberate separate release after reviewing the current SDK, restoring its dependencies, testing wallet network changes and signatures, reconciling order state after reload/rejection/partial fills, and validating testnet-only behavior.
