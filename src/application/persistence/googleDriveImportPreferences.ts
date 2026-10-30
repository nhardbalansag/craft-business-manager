const API_KEY_STORAGE = 'craft-business-manager.google-drive-browser-key';
const SOURCE_STORAGE = 'craft-business-manager.google-drive-source';

function siteApiKey(): string {
  return import.meta.env.VITE_GOOGLE_DRIVE_API_KEY?.trim() ?? '';
}

export function getGoogleDriveApiKey(): string {
  try {
    return window.localStorage.getItem(API_KEY_STORAGE)?.trim() || siteApiKey();
  } catch {
    return siteApiKey();
  }
}

export function saveGoogleDriveApiKey(value: string): void {
  const key = value.trim();
  if (key && !/^[A-Za-z0-9_-]{16,200}$/.test(key)) {
    throw new Error('Enter a Google API browser key, using letters, numbers, underscores, and hyphens.');
  }
  if (key) window.localStorage.setItem(API_KEY_STORAGE, key);
  else window.localStorage.removeItem(API_KEY_STORAGE);
}

export function getLastGoogleDriveUrl(): string {
  try { return window.localStorage.getItem(SOURCE_STORAGE) ?? ''; } catch { return ''; }
}

export function rememberGoogleDriveUrl(value: string): void {
  try { window.localStorage.setItem(SOURCE_STORAGE, value); } catch { /* Import remains usable. */ }
}
