// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGoogleDriveApiKey, getLastGoogleDriveUrl, rememberGoogleDriveUrl,
  saveGoogleDriveApiKey } from './googleDriveImportPreferences';

beforeEach(() => vi.stubEnv('VITE_GOOGLE_DRIVE_API_KEY', ''));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); window.localStorage.clear(); });

describe('Google Drive browser configuration', () => {
  it('uses the site default, permits a local override, and clears only the override', () => {
    vi.stubEnv('VITE_GOOGLE_DRIVE_API_KEY', 'configured-site-browser-key');
    expect(getGoogleDriveApiKey()).toBe('configured-site-browser-key');
    saveGoogleDriveApiKey('  custom-browser-key-12345  ');
    expect(getGoogleDriveApiKey()).toBe('custom-browser-key-12345');
    saveGoogleDriveApiKey('');
    expect(getGoogleDriveApiKey()).toBe('configured-site-browser-key');
    expect(() => saveGoogleDriveApiKey('not a browser key')).toThrow();
  });

  it('falls back to site configuration when storage is blocked and reports failed explicit saves', () => {
    vi.stubEnv('VITE_GOOGLE_DRIVE_API_KEY', 'configured-site-browser-key');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getGoogleDriveApiKey()).toBe('configured-site-browser-key');
    expect(() => saveGoogleDriveApiKey('custom-browser-key-12345')).toThrow('blocked');
    expect(() => rememberGoogleDriveUrl('https://drive.google.com/file/d/test/view')).not.toThrow();
  });

  it('remembers the source independently of the API key', () => {
    rememberGoogleDriveUrl('https://drive.google.com/file/d/test/view');
    expect(getLastGoogleDriveUrl()).toBe('https://drive.google.com/file/d/test/view');
    expect(getGoogleDriveApiKey()).toBe('');
  });
});
