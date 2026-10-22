import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The Play Store link must resolve to a *static public HTML document*, even
 * before React loads and without requiring the workspace app to initialize.
 */
const html = readFileSync(
  new URL('../public/privacy-policy/index.html', import.meta.url),
  'utf8',
);

describe('public My Lovely Craft Android privacy policy', () => {
  it('ships a standalone, readable HTML document with app-specific identification', () => {
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<title>Privacy Policy | My Lovely Craft Mobile App</title>');
    expect(html).toContain('com.mylovelycraft.mobile');
    expect(html).toContain('<h1>Privacy Policy</h1>');
    expect(html).toContain('October 23, 2026');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('robots" content="noindex');
  });

  it('discloses collection, use, sharing, protection, retention, deletion and a public contact mechanism', () => {
    const sections = [
      'Information the app handles',
      'Why information is used',
      'Sharing and third-party services',
      'Device permissions and access',
      'Security',
      'Retention, deletion and your choices',
      'Privacy contact',
    ];
    for (const heading of sections) expect(html).toContain(heading);
    expect(html).toContain('customer names');
    expect(html).toContain('Google Sheets');
    expect(html).toContain('Bluetooth');
    expect(html).toContain('Android');
    expect(html).toContain('100 records');
    expect(html).toContain('Clear storage');
    expect(html).toContain('https://www.facebook.com/profile.php?id=100066725041959');
  });

  it('does not pretend this static web page is already live or that the mobile app has been modified', () => {
    expect(html).not.toContain('This page has been deployed');
    expect(html).not.toContain('Privacy Policy updated in the Android app');
  });
});
