/**
 * Mini magasin clé-valeur sur IndexedDB, sans dépendance.
 *
 * Pourquoi IndexedDB et pas localStorage : localStorage plafonne vers 5 Mo
 * par site, alors qu'un rapport embarque ses photos (≈200 Ko chacune après
 * réduction). IndexedDB accepte des centaines de Mo.
 *
 * Toutes les données restent dans le navigateur du poste : rien ne part
 * sur un serveur.
 */

// Nom historique conservé volontairement : le changer ferait « perdre » aux navigateurs
// les rapports et carnets déjà enregistrés (IndexedDB est rangée par nom de base).
const DB_NAME = 'dronereport-collectivite'
const DB_VERSION = 1
/** Un seul « store » : les brouillons de rapport, indexés par sessionUuid. */
export const STORE_DRAFTS = 'drafts'
/** Les carnets de notes terrain, indexés par id. */
export const STORE_CARNETS = 'carnets'

let dbPromise: Promise<IDBDatabase> | null = null

/** Ouvre (ou crée) la base. La promesse est mise en cache. */
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) db.createObjectStore(STORE_DRAFTS)
      if (!db.objectStoreNames.contains(STORE_CARNETS)) db.createObjectStore(STORE_CARNETS)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

/** Lance une transaction et renvoie le résultat de la requête. */
async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const req = fn(tx.objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Écrit une valeur. */
export function idbPut<T>(store: string, key: string, value: T): Promise<IDBValidKey> {
  return run(store, 'readwrite', (s) => s.put(value, key))
}

/** Supprime une valeur. */
export function idbDelete(store: string, key: string): Promise<undefined> {
  return run(store, 'readwrite', (s) => s.delete(key))
}

/** Lit toutes les valeurs d'un store. */
export function idbGetAll<T>(store: string): Promise<T[]> {
  return run(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
}
