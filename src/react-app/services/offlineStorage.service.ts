export type OfflineStore = 'favoritos' | 'customizadas' | 'historico' | 'perfil';

const DB_NAME = 'meufenil-offline';
const DB_VERSION = 1;
const DATA_STORE = 'offline-data';
const META_STORE = 'offline-meta';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dataKey(store: OfflineStore, userId: string): string {
  return `${userId}:${store}`;
}

export async function write(store: OfflineStore, userId: string, data: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DATA_STORE, 'readwrite');
    const os = tx.objectStore(DATA_STORE);
    const req = os.put({ id: dataKey(store, userId), data });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function read(store: OfflineStore, userId: string): Promise<unknown | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DATA_STORE, 'readonly');
    const os = tx.objectStore(DATA_STORE);
    const req = os.get(dataKey(store, userId));
    req.onsuccess = () => resolve(req.result?.data ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

const ALL_STORES: OfflineStore[] = ['favoritos', 'customizadas', 'historico', 'perfil'];

export async function clearUser(userId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([DATA_STORE, META_STORE], 'readwrite');
    const dataOs = tx.objectStore(DATA_STORE);
    const metaOs = tx.objectStore(META_STORE);

    for (const store of ALL_STORES) {
      dataOs.delete(dataKey(store, userId));
    }
    metaOs.delete(`lastsync:${userId}`);

    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearDelegado(userId: string): Promise<void> {
  return clearUser(userId);
}

export async function clearAll(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

export async function getLastSync(userId: string): Promise<Date | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const os = tx.objectStore(META_STORE);
    const req = os.get(`lastsync:${userId}`);
    req.onsuccess = () => {
      const val = req.result?.value;
      resolve(val ? new Date(val) : null);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function setLastSync(userId: string, date: Date): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const os = tx.objectStore(META_STORE);
    const req = os.put({ id: `lastsync:${userId}`, value: date.toISOString() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export interface OfflineCounts {
  favoritos: number;
  customizadas: number;
  historico: number;
  historicoInicio?: string;
  historicoFim?: string;
  lastSync: Date | null;
}

export async function getCounts(userId: string): Promise<OfflineCounts> {
  const [favs, custs, hist, lastSync] = await Promise.all([
    read('favoritos', userId),
    read('customizadas', userId),
    read('historico', userId),
    getLastSync(userId),
  ]);

  const favsArr = Array.isArray(favs) ? favs : [];
  const custsArr = Array.isArray(custs) ? custs : [];
  const histArr = Array.isArray(hist) ? hist : [];

  const dates = histArr
    .map((r: Record<string, unknown>) => typeof r.data === 'string' ? r.data : '')
    .filter(Boolean)
    .sort();

  return {
    favoritos: favsArr.length,
    customizadas: custsArr.length,
    historico: histArr.length,
    historicoInicio: dates[0],
    historicoFim: dates[dates.length - 1],
    lastSync,
  };
}
