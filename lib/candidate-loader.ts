import { readCandidateCache, writeCandidateCache } from "./candidate-cache";
import {
  parseCandidatePayload,
  type CandidateManifest,
} from "./candidate-types";

export async function loadCandidateSnapshot(manifest: CandidateManifest) {
  const cacheKey = manifest.testVersion.id;
  const expectedHash = manifest.testVersion.candidatePayloadHash;
  const cached = await readCandidateCache(cacheKey, expectedHash);

  try {
    const response = await fetch(manifest.candidateUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error(`CDN returned ${response.status}`);
    const raw = await response.text();
    const actualHash = await sha256(raw);
    if (actualHash !== expectedHash) {
      throw new Error("Candidate snapshot hash does not match the published version");
    }
    const payload = parseCandidatePayload(JSON.parse(raw) as unknown);
    await writeCandidateCache(cacheKey, expectedHash, payload);
    return { payload, source: "network" as const };
  } catch (error) {
    if (cached) return { payload: cached, source: "cache" as const };
    throw error;
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
