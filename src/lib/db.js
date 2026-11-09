// Accès bas niveau à IndexedDB (trois magasins : listes, parties, étiquettes).

const DB_NAME = 'analyse-40k';
const DB_VERSION = 1;
export const STORES = ['listes', 'parties', 'labels'];

let dbPromise = null;

export function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES)
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

const wrap = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const done = (t) =>
  new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });

export async function getAll(store) {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).getAll());
}

export async function getOne(store, id) {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).get(id));
}

/** Ajoute un enregistrement (l'identifiant est attribué par la base) et renvoie son id. */
export async function add(store, obj) {
  const db = await openDb();
  const { id: _ignored, ...rest } = obj;
  const t = db.transaction(store, 'readwrite');
  const idReq = t.objectStore(store).add(rest);
  await done(t);
  return idReq.result;
}

export async function put(store, obj) {
  const db = await openDb();
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).put(obj);
  await done(t);
}

export async function remove(store, id) {
  const db = await openDb();
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).delete(id);
  await done(t);
}

/** Remplace tout le contenu en une seule transaction (restauration) : tout ou rien. */
export async function replaceAll(data) {
  const db = await openDb();
  const t = db.transaction(STORES, 'readwrite');
  for (const s of STORES) {
    const os = t.objectStore(s);
    os.clear();
    for (const row of data[s] ?? []) os.put(row);
  }
  await done(t);
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* sans effet : la sauvegarde reste le filet de sécurité */
  }
  return false;
}

export async function isPersisted() {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}
