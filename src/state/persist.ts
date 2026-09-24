/**
 * Úložiště na stažená data. localStorage má pět megabajtů a předpověď pro osm
 * míst na devět dní má stovky kilobajtů — na pár tras by nestačil. IndexedDB
 * unese mnohem víc a nezdržuje hlavní vlákno.
 *
 * Všechno je „nejlepší snaha": v anonymním okně nebo se zaplněným úložištěm
 * appka běží dál, jen si nic nepamatuje.
 */

const DB_NAME = 'navrchol'
const STORE = 'bundles'

let opening: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  if (opening) return opening
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opening
}

export async function readBundle<T>(key: string): Promise<T | null> {
  const db = await open()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function writeBundle(key: string, value: unknown): Promise<void> {
  const db = await open()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** Uklidí data tras, které už neexistují. */
export async function pruneBundles(keep: Set<string>): Promise<void> {
  const db = await open()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const req = store.getAllKeys()
      req.onsuccess = () => {
        for (const k of req.result) if (typeof k === 'string' && !keep.has(k)) store.delete(k)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
