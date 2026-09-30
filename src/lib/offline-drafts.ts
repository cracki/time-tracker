/**
 * Offline drafts — IndexedDB store (spec §32/§33).
 * Tiny hand-rolled wrapper; localStorage is never used for log data.
 */

const DB_NAME = "timetrack-db";
const DB_VERSION = 1;
const STORE = "drafts";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB error"));
        t.oncomplete = () => d.close();
      }),
  );
}

export interface DraftRecord {
  id: string;
  workDate: string;
  description: string;
  durationMinutes: number;
  createdAt: string;
}

export const offlineDrafts = {
  async add(draft: Omit<DraftRecord, "id" | "createdAt">): Promise<DraftRecord> {
    const record: DraftRecord = {
      ...draft,
      id: `draft-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      createdAt: new Date().toISOString(),
    };
    await tx("readwrite", (s) => s.put(record));
    return record;
  },
  async list(): Promise<DraftRecord[]> {
    try {
      const all = await tx<DraftRecord[]>("readonly", (s) => s.getAll() as IDBRequest<DraftRecord[]>);
      return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } catch {
      return [];
    }
  },
  async remove(id: string): Promise<void> {
    await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
  },
  async count(): Promise<number> {
    try {
      return await tx<number>("readonly", (s) => s.count());
    } catch {
      return 0;
    }
  },
};
