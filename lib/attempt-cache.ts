import type { AttemptAnswer, AttemptTiming } from "./candidate-types";

const databaseName = "pace-lingo-attempts";
const storeName = "attempt-state";

export interface LocalAttemptState {
  attemptId: string;
  answers: Record<string, AttemptAnswer>;
  timings: Record<string, AttemptTiming>;
  updatedAt: number;
}

export async function readAttemptCache(attemptId: string) {
  if (typeof indexedDB === "undefined") return null;
  try {
    const database = await openDatabase();
    const result = await request<LocalAttemptState | undefined>(
      database.transaction(storeName).objectStore(storeName).get(attemptId),
    );
    database.close();
    return result ?? null;
  } catch {
    return null;
  }
}

export async function writeAttemptCache(state: LocalAttemptState) {
  if (typeof indexedDB === "undefined") return;
  try {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(state);
    await transactionDone(transaction);
    database.close();
  } catch {
    // PostgreSQL remains authoritative; this is short offline protection.
  }
}

export async function deleteAttemptCache(attemptId: string) {
  if (typeof indexedDB === "undefined") return;
  try {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(attemptId);
    await transactionDone(transaction);
    database.close();
  } catch {
    // A stale cache is ignored once its attempt is terminal.
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const opening = indexedDB.open(databaseName, 1);
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(storeName)) {
        opening.result.createObjectStore(storeName, { keyPath: "attemptId" });
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
