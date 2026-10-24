
import type { PerpetualMarket } from "./types.js";

const API_URL = "https://api.hyperliquid-testnet.xyz/info";

type AssetMeta = {
  universe: Array<{
    name: string;
    maxLeverage?: number;
  }>;
};

type AssetContext = {
  funding?: string;
  openInterest?: string;
  dayNtlVlm?: string;
  markPx?: string;
  oraclePx?: string;
};

function toNumber(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export async function getHyperliquidMarkets(): Promise<PerpetualMarket[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Hyperliquid returned HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload) || payload.length < 2) {
      throw new Error("Unexpected Hyperliquid response");
    }

    const meta = payload[0] as AssetMeta;
    const contexts = payload[1] as AssetContext[];

    if (!Array.isArray(meta.universe) || !Array.isArray(contexts)) {
      throw new Error("Invalid Hyperliquid market data");
    }

    return meta.universe.flatMap((asset, index) => {
      const context = contexts[index];

      if (!context) {
        return [];
      }

      return [
        {
          venue: "hyperliquid" as const,
          symbol: `${asset.name}-USD`,
          baseAsset: asset.name,
          quoteAsset: "USD",
          markPrice: toNumber(context.markPx),
          oraclePrice: toNumber(context.oraclePx),
          fundingRate: toNumber(context.funding),
          openInterest: toNumber(context.openInterest),
          volume24h: toNumber(context.dayNtlVlm),
          maxLeverage: toNumber(asset.maxLeverage),
          updatedAt: new Date().toISOString(),
        },
      ];
    });
  } finally {
    clearTimeout(timeout);
  }
}
