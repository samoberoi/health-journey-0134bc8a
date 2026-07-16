import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";

const KEY_LIST = "bb_native_persisted_keys";
const LAST_HYDRATED_KEY = "bb_native_last_hydrated_at";
const EXPLICIT_LOGOUT_STORAGE_KEY = "bb_explicit_logout";
const AUTH_SESSION_BACKUP_KEY = "bb_native_auth_session_backup";
const pendingWrites = new Set<Promise<unknown>>();
let nativePersistenceQueue: Promise<unknown> = Promise.resolve();

type NativeAuthSessionBackup = {
  key: string;
  value: string;
  savedAt: number;
};

function isNativeApp() {
  return Capacitor.isNativePlatform();
}

function shouldPersistKey(key: string) {
  const lower = key.toLowerCase();
  return (
    key.startsWith("sb-") ||
    lower.includes("supabase") ||
    (key.startsWith("bb_") && key !== EXPLICIT_LOGOUT_STORAGE_KEY)
  );
}

function isAuthStorageKey(key: string) {
  const lower = key.toLowerCase();
  return key.startsWith("sb-") || lower.includes("supabase");
}

function parseAuthBackup(value: string | null): NativeAuthSessionBackup | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<NativeAuthSessionBackup>;
    if (typeof parsed.key === "string" && typeof parsed.value === "string") {
      return {
        key: parsed.key,
        value: parsed.value,
        savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
      };
    }
  } catch {
    /* ignore corrupt native backup */
  }
  return null;
}

async function saveAuthSessionBackup(key: string, value: string) {
  if (!isAuthStorageKey(key) || !value) return;
  const backup: NativeAuthSessionBackup = { key, value, savedAt: Date.now() };
  await Preferences.set({ key: AUTH_SESSION_BACKUP_KEY, value: JSON.stringify(backup) });
}

async function readAuthSessionBackup() {
  try {
    const { value } = await Preferences.get({ key: AUTH_SESSION_BACKUP_KEY });
    return parseAuthBackup(value);
  } catch {
    return null;
  }
}

async function writePersistedKey(key: string, value: string) {
  await Preferences.set({ key, value });
  await saveAuthSessionBackup(key, value);
  await rememberKey(key);
}

async function removePersistedKey(key: string) {
  await Preferences.remove({ key });
  await forgetKey(key);
}

async function readPersistedKeyList(): Promise<string[]> {
  try {
    const { value } = await Preferences.get({ key: KEY_LIST });
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

async function rememberKey(key: string) {
  if (!shouldPersistKey(key)) return;
  const keys = new Set(await readPersistedKeyList());
  keys.add(key);
  await Preferences.set({ key: KEY_LIST, value: JSON.stringify([...keys]) });
}

async function forgetKey(key: string) {
  const keys = new Set(await readPersistedKeyList());
  keys.delete(key);
  await Preferences.set({ key: KEY_LIST, value: JSON.stringify([...keys]) });
}

function trackNativeWrite(write: Promise<unknown>) {
  pendingWrites.add(write);
  void write.finally(() => pendingWrites.delete(write));
}

function serializeNativePersistence<T>(operation: () => Promise<T>): Promise<T> {
  if (!isNativeApp()) return operation();
  const run = nativePersistenceQueue.then(operation, operation);
  nativePersistenceQueue = run.catch(() => undefined);
  return run;
}

export async function flushNativePersistenceWrites() {
  if (!isNativeApp() || pendingWrites.size === 0) return;
  await Promise.allSettled([...pendingWrites]);
}

export async function hydrateNativePersistence() {
  if (!isNativeApp()) return;
  return serializeNativePersistence(async () => {
  try {
    const authBackup = await readAuthSessionBackup();
    if (authBackup) {
      localStorage.setItem(authBackup.key, authBackup.value);
      await Preferences.set({ key: authBackup.key, value: authBackup.value });
      await rememberKey(authBackup.key);
    }

    const listedKeys = await readPersistedKeyList();
    const { keys: allPreferenceKeys } = await Preferences.keys();
    const keys = new Set([
      ...listedKeys,
      ...allPreferenceKeys.filter((key) => shouldPersistKey(key)),
    ]);

    for (const key of keys) {
      if (key === AUTH_SESSION_BACKUP_KEY) continue;
      const { value } = await Preferences.get({ key });
      if (value == null) {
        if (authBackup?.key === key) {
          localStorage.setItem(key, authBackup.value);
          await Preferences.set({ key, value: authBackup.value });
        } else {
          localStorage.removeItem(key);
        }
      } else {
        localStorage.setItem(key, value);
        await saveAuthSessionBackup(key, value);
      }
    }
    localStorage.setItem(LAST_HYDRATED_KEY, String(Date.now()));
  } catch (error) {
    console.warn("Native persistence hydration failed", error);
  }
  });
}

export async function hasNativePersistedAuthSession(): Promise<boolean> {
  if (!isNativeApp()) return false;
  return serializeNativePersistence(async () => {
  try {
    const authBackup = await readAuthSessionBackup();
    if (authBackup?.value) return true;

    const listedKeys = await readPersistedKeyList();
    const { keys: allPreferenceKeys } = await Preferences.keys();
    const keys = new Set([...listedKeys, ...allPreferenceKeys]);
    for (const key of keys) {
      if (isAuthStorageKey(key)) {
        const { value } = await Preferences.get({ key });
        if (value) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
  });
}

export function installNativePersistenceMirror() {
  if (!isNativeApp()) return;
  const storage = window.localStorage as Storage & { __bbNativeMirrorInstalled?: boolean };
  if (storage.__bbNativeMirrorInstalled) return;
  storage.__bbNativeMirrorInstalled = true;

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const originalClear = Storage.prototype.clear;

  Storage.prototype.setItem = function setItem(key: string, value: string) {
    originalSetItem.call(this, key, value);
    if (this === storage && shouldPersistKey(key)) {
      trackNativeWrite(serializeNativePersistence(() => writePersistedKey(key, value)));
    }
  };

  Storage.prototype.removeItem = function removeItem(key: string) {
    originalRemoveItem.call(this, key);
    if (this === storage && shouldPersistKey(key)) {
      trackNativeWrite(serializeNativePersistence(() => removePersistedKey(key)));
    }
  };

  Storage.prototype.clear = function clear() {
    if (this === storage) {
      trackNativeWrite(serializeNativePersistence(async () => {
        const keys = await readPersistedKeyList();
        await Promise.all(keys.map((key) => Preferences.remove({ key })));
        await Preferences.remove({ key: KEY_LIST });
      }));
    }
    originalClear.call(this);
  };
}

export function installNativePersistenceLifecycleFlush() {
  if (!isNativeApp()) return;
  void CapApp.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) void flushNativePersistenceWrites();
  });
  void CapApp.addListener("pause", () => {
    void flushNativePersistenceWrites();
  });
}

export async function syncNativePersistenceFromLocalStorage() {
  if (!isNativeApp()) return;
  return serializeNativePersistence(async () => {
  await flushNativePersistenceWrites();
  const previousKeys = await readPersistedKeyList();
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && shouldPersistKey(key)) keys.push(key);
  }
  const currentKeys = new Set(keys);
  const hasCurrentAuthKeys = keys.some((key) => isAuthStorageKey(key));
  await Promise.all(
    [
      ...keys.map(async (key) => {
        const value = localStorage.getItem(key);
        if (value != null) {
          await Preferences.set({ key, value });
          await saveAuthSessionBackup(key, value);
        }
      }),
      ...previousKeys
        .filter((key) => {
          if (currentKeys.has(key)) return false;
          const authKey = isAuthStorageKey(key);
          return hasCurrentAuthKeys || !authKey;
        })
        .map((key) => Preferences.remove({ key })),
    ]
  );
  const nextKeys = hasCurrentAuthKeys
    ? keys
    : [...new Set([...previousKeys.filter((key) => {
        return isAuthStorageKey(key);
      }), ...keys])];
  await Preferences.set({ key: KEY_LIST, value: JSON.stringify(nextKeys) });
  });
}

export async function persistAuthSessionToNative() {
  if (!isNativeApp()) return;
  return serializeNativePersistence(async () => {
  await flushNativePersistenceWrites();
  const authKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (isAuthStorageKey(key)) {
      authKeys.push(key);
    }
  }

  await Promise.all(
    authKeys.map(async (key) => {
      const value = localStorage.getItem(key);
      if (value != null) await writePersistedKey(key, value);
    })
  );
  const persistedKeys = await readPersistedKeyList();
  await Preferences.set({ key: KEY_LIST, value: JSON.stringify([...new Set([...persistedKeys, ...authKeys])]) });
  await flushNativePersistenceWrites();
  });
}

export async function clearNativePersistedAuthState() {
  if (!isNativeApp()) return;
  return serializeNativePersistence(async () => {
  await flushNativePersistenceWrites();
  const persistedKeys = await readPersistedKeyList();
  const authKeys = persistedKeys.filter((key) => {
    return isAuthStorageKey(key) || key.startsWith("bb_");
  });
  await Promise.all(authKeys.map((key) => Preferences.remove({ key })));
  await Preferences.remove({ key: AUTH_SESSION_BACKUP_KEY });
  await Preferences.set({ key: KEY_LIST, value: JSON.stringify(persistedKeys.filter((key) => !authKeys.includes(key))) });
  });
}

export async function getNativePersistenceDiagnostics() {
  if (!isNativeApp()) {
    return {
      native: false,
      hasAuthBackup: false,
      persistedAuthKeys: 0,
      preferenceKeys: 0,
      hydratedAt: localStorage.getItem(LAST_HYDRATED_KEY),
    };
  }

  return serializeNativePersistence(async () => {
  try {
    const [listedKeys, authBackup, preferences] = await Promise.all([
      readPersistedKeyList(),
      readAuthSessionBackup(),
      Preferences.keys(),
    ]);
    const persistedAuthKeys = new Set([
      ...listedKeys.filter(isAuthStorageKey),
      ...preferences.keys.filter(isAuthStorageKey),
      ...(authBackup?.key ? [authBackup.key] : []),
    ]);
    return {
      native: true,
      hasAuthBackup: Boolean(authBackup?.value),
      persistedAuthKeys: persistedAuthKeys.size,
      preferenceKeys: preferences.keys.length,
      hydratedAt: localStorage.getItem(LAST_HYDRATED_KEY),
    };
  } catch (error) {
    return {
      native: true,
      hasAuthBackup: false,
      persistedAuthKeys: 0,
      preferenceKeys: 0,
      hydratedAt: localStorage.getItem(LAST_HYDRATED_KEY),
      error: error instanceof Error ? error.message : "Native Preferences did not respond.",
    };
  }
  });
}
