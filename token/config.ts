import { PublicKey } from "@solana/web3.js";

const isMainnet = false; // true -> mainnet-beta, false -> devnet

export const NETWORK = isMainnet ? "mainnet-beta" : "devnet";
export const SOLSCAN_CLUSTER = isMainnet ? "" : "?cluster=devnet";

export const BUNDLR_URL = isMainnet
  ? "https://node1.bundlr.network"
  : "https://devnet.bundlr.network";

//test with blockscan APIs for tx and keys and addresses
export const BLOCKSCAN_URL = "https://blocktestingto.com";

export const TOKEN_IMG_NAME = "AIChaincoin.webp";
export const TOKEN_IMG_PATH = `assets/${TOKEN_IMG_NAME}`;
export const TOKEN_NAME = "AIChainCoin";
export const TOKEN_SYMBOL = "AIC";
export const TOKEN_DESCRIPTION = "for all workers of the world";
export const TOKEN_DECIMAL = 6;
export const INIT_FEE_PERCENTAGE = 300; // 3%
export const MAX_FEE = 1_000; // 1,000 tokens
export const MINT_AMOUNT = 1_000_000_000; // 1,000,000 tokens
export const TRANSFER_AMOUNT = 1_000; // 1,000 tokens

export const TOKEN_MINT = new PublicKey("C4dF2xjCgByPdBb7QqXczguAS5xs8JpsHBioscod9Nod");

export const FEE_VAULT = new PublicKey("G3DxqKKCuaapt8LAdL6GaR7Z6KNXe4a8T8kiPeoB6eSh");

export const DESTINATION_WALLET = new PublicKey("G3DxqKKCuaapt8LAdL6GaR7Z6KNXe4a8T8kiPeoB6eSh");

export const METADATA_2022_PROGRAM_ID = new PublicKey(
  isMainnet
    ? "META4s4fSmpkTbZoUsgC1oBnWB31vQcmnN8giPw51Zu"
    : "M1tgEZCz7fHqRAR3G5RLxU6c6ceQiZyFK7tzzy4Rof4"
);

export const WITHDRAW_PERIOD = 100; // in seconds
