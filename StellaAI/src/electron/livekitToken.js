/* =========================================================
   LIVEKIT TOKEN GENERATOR (Node / Electron)
========================================================= */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, "utf8");
    const result = {};
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        result[key] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function getLiveKitConfig() {
  const envCandidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(process.cwd(), "../STELLA BACKEND/.env"),
    path.resolve(__dirname, "../../../STELLA BACKEND/.env"),
    "D:/STELLA AI/STELLA BACKEND/.env",
    "D:/VSCode/Python/New AI Project/.env",
  ];

  let mergedEnv = {};
  for (const envPath of envCandidates) {
    mergedEnv = { ...loadEnvFile(envPath), ...mergedEnv };
  }

  const url = process.env.LIVEKIT_URL || mergedEnv.LIVEKIT_URL || "";
  const apiKey = process.env.LIVEKIT_API_KEY || mergedEnv.LIVEKIT_API_KEY || "";
  const apiSecret = process.env.LIVEKIT_API_SECRET || mergedEnv.LIVEKIT_API_SECRET || "";

  return { url, apiKey, apiSecret };
}

export function generateLiveKitToken({
  roomName = "stella-room",
  participantName = "User",
  identity = "stella-user-client",
} = {}) {
  const { url, apiKey, apiSecret } = getLiveKitConfig();

  if (!url || !apiKey || !apiSecret) {
    throw new Error("Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    exp: now + 3600 * 24, // 24 hours
    nbf: now - 5,
    iss: apiKey,
    sub: identity,
    name: participantName,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const toBase64Url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsignedToken = `${toBase64Url(header)}.${toBase64Url(payload)}`;
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(unsignedToken)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const token = `${unsignedToken}.${signature}`;

  return {
    serverUrl: url,
    token,
    roomName,
    identity,
  };
}
