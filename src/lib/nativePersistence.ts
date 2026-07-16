import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";

const KEY_LIST = "bb_native_persisted_keys";
const LAST_HYDRATED_KEY = "bb_native_last_hydrated_at";
const EXPLICIT_LOGOUT_STORAGE_KEY = "bb_explicit_logout";
const pendingWrites = new Set<Promise<unknown>>();

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

async function writePersistedKey(key: string, value: string) {
  await Preferences.set({ key, value });
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

export async function flushNativePersistenceWrites() {
  if (!isNativeApp() || pendingWrites.size === 0) return;
  await Promise.allSettled([...pendingWrites]);
}

export async function hydrateNativePersistence() {
  if (!isNativeApp()) return;
  try {
    const listedKeys = await readPersistedKeyList();
    const { keys: allPreferenceKeys } = await Preferences.keys();
    const keys = new Set([
      ...listedKeys,
      ...allPreferenceKeys.filter((key) => shouldPersistKey(key)),
    ]);

    for (const key of keys) {
      const { value } = await Preferences.get({ key });
      if (value == null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    }
    localStorage.setItem(LAST_HYDRATED_KEY, String(Date.now()));
  } catch (error) {
    console.warn("Native persistence hydration failed", error);
  }
}

export async function hasNativePersistedAuthSession(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const listedKeys = await readPersistedKeyList();
    const { keys: allPreferenceKeys } = await Preferences.keys();
    const keys = new Set([...listedKeys, ...allPreferenceKeys]);
    for (const key of keys) {
      const lower = key.toLowerCase();
      if (key.startsWith("sb-") || lower.includes("supabase")) {
        const { value } = await Preferences.get({ key });
        if (value) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
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
      trackNativeWrite(writePersistedKey(key, value));
    }
  };

  Storage.prototype.removeItem = function removeItem(key: string) {
    originalRemoveItem.call(this, key);
    if (this === storage && shouldPersistKey(key)) {
      trackNativeWrite(removePersistedKey(key));
    }
  };

  Storage.prototype.clear = function clear() {
    if (this === storage) {
      trackNativeWrite((async () => {
        const keys = await readPersistedKeyList();
        await Promise.all(keys.map((key) => Preferences.remove({ key })));
        await Preferences.remove({ key: KEY_LIST });
      })());
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
  await flushNativePersistenceWrites();
  const previousKeys = await readPersistedKeyList();
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && shouldPersistKey(key)) keys.push(key);
  }
  const currentKeys = new Set(keys);
  const hasCurrentAuthKeys = keys.some((key) => {
    const lower = key.toLowerCase();
    return key.startsWith("sb-") || lower.includes("supabase");
  });
  await Promise.all(
    [
      ...keys.map(async (key) => {
        const value = localStorage.getItem(key);
        if (value != null) {
          await Preferences.set({ key, value });
        }
      }),
      ...previousKeys
        .filter((key) => {
          if (currentKeys.has(key)) return false;
          const lower = key.toLowerCase();
          const isAuthKey = key.startsWith("sb-") || lower.includes("supabase");
          return hasCurrentAuthKeys || !isAuthKey;
        })
        .map((key) => Preferences.remove({ key })),
    ]
  );
  const nextKeys = hasCurrentAuthKeys
    ? keys
    : [...new Set([...previousKeys.filter((key) => {
        const lower = key.toLowerCase();
        return key.startsWith("sb-") || lower.includes("supabase");
      }), ...keys])];
  await Preferences.set({ key: KEY_LIST, value: JSON.stringify(nextKeys) });
}

export async function persistAuthSessionToNative() {
  if (!isNativeApp()) return;
  await flushNativePersistenceWrites();
  const authKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    const lower = key.toLowerCase();
    if (key.startsWith("sb-") || lower.includes("supabase")) {
      authKeys.push(key);
    }
  }

  await Promise.all(
    authKeys.map(async (key) => {
      const value = localStorage.getItem(key);
      if (value != null) await writePersistedKey(key, value);
    })
  );
  await syncNativePersistenceFromLocalStorage();
  await flushNativePersistenceWrites();
}

export async function clearNativePersistedAuthState() {
  if (!isNativeApp()) return;
  await flushNativePersistenceWrites();
  const persistedKeys = await readPersistedKeyList();
  const authKeys = persistedKeys.filter((key) => {
    const lower = key.toLowerCase();
    return key.startsWith("sb-") || lower.includes("supabase") || key.startsWith("bb_");
  });
  await Promise.all(authKeys.map((key) => Preferences.remove({ key })));
  await Preferences.set({ key: KEY_LIST, value: JSON.stringify(persistedKeys.filter((key) => !authKeys.includes(key))) });
}
