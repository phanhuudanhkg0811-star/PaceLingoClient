import type { CandidatePayload } from "./candidate-types";

const databaseName = "pace-lingo-runtime";
const storeName = "candidate-snapshots";

interface CacheEntry {
  key: string;
  hash: string;
  payload: CandidatePayload;
  cachedAt: number;
}

export async function readCandidateCache(key: string, hash: string) {
  if (typeof indexedDB === "undefined") return null;
  try {
    const database = await openDatabase();
    const entry = await request<CacheEntry | undefined>(
      database.transaction(storeName).objectStore(storeName).get(key),
    );
    database.close();
    return entry?.hash === hash ? entry.payload : null;
  } catch {
    return null;
  }
}

export async function writeCandidateCache(
  key: string,
  hash: string,
  payload: CandidatePayload,
) {
  if (typeof indexedDB === "undefined") return;
  try {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put({
      key,
      hash,
      payload,
      cachedAt: Date.now(),
    } satisfies CacheEntry);
    await transactionDone(transaction);
    database.close();
  } catch {
    // Cache is an optimization. Runtime may continue with the in-memory payload.
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const opening = indexedDB.open(databaseName, 1);
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(storeName)) {
        opening.result.createObjectStore(storeName, { keyPath: "key" });
      }
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
}

function request<T>(value: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
