export type VenueId = "hyperliquid" | "dydx";

export interface PerpetualMarket {
  venue: VenueId;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  markPrice: number | null;
  oraclePrice: number | null;
  fundingRate: number | null;
  openInterest: number | null;
  volume24h: number | null;
  maxLeverage: number | null;
  updatedAt: string;
}

export interface NormalizedMarket {
  venue: VenueId;
  network: "testnet" | "mainnet";
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  markPrice: number | null;
  fundingRate: number | null;
  openInterest: number | null;
  priceChange24h: number | null;
  volume24h: number | null;
  updatedAt: string;
}

export interface RouteCandidate {
  venue: VenueId;
  network: "testnet" | "mainnet";
  markPrice: number | null;
  fundingRate: number | null;
  openInterest: number | null;
  volume24h: number | null;
  executionEnabled: boolean;
  executable: false;
  score: number | null;
  reasons: string[];
}

export interface VenueStatus {
  id: VenueId;
  name: string;
  network: "testnet" | "mainnet";
  connected: boolean;
  executionEnabled: boolean;
}