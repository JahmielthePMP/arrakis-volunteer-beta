const baseUrl = (process.env.ARRAKIS_API_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const checks = [
  { name: "health endpoint", path: "/health", validate: (payload) => payload?.status === "ok" && payload?.service === "arrakis-api" },
  { name: "venue registry", path: "/api/venues", validate: (payload) => Array.isArray(payload?.venues) && payload.venues.length > 0 },
  { name: "AI status endpoint", path: "/api/assistant/status", validate: (payload) => typeof payload?.configured === "boolean" && Array.isArray(payload?.tools) && payload?.executionEnabled === false },
];
let failed = 0;
for (const check of checks) {
  try {
    const response = await fetch(`${baseUrl}${check.path}`, { signal: AbortSignal.timeout(6000) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !check.validate(payload)) {
      failed += 1;
      console.error(`FAIL ${check.name}: HTTP ${response.status}`);
    } else {
      console.log(`PASS ${check.name}`);
    }
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${check.name}: ${error instanceof Error ? error.message : "request failed"}`);
  }
}
if (failed) {
  console.error(`\n${failed} check(s) failed. Start the ARRAKIS backend with npm run server and run this script again.`);
  process.exitCode = 1;
} else {
  console.log("\nARRAKIS backend smoke checks passed. These checks do not place trades or validate the live testnet wallet flow.");
}
