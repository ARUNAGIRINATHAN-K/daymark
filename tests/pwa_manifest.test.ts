import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Master Prompt 07: PWA Implementation & Manifest Compliance', () => {
  const rootDir = process.cwd();

  it('provides required public icon assets for PWA installability', () => {
    const requiredFiles = [
      'public/favicon.ico',
      'public/icon.svg',
      'public/apple-touch-icon.png',
      'public/pwa-192x192.png',
      'public/pwa-512x512.png',
      'public/pwa-maskable-512x512.png',
    ];

    for (const relPath of requiredFiles) {
      const fullPath = path.join(rootDir, relPath);
      expect(fs.existsSync(fullPath), `Missing required icon asset: ${relPath}`).toBe(true);
    }
  });

  it('provides public/offline.html application shell fallback file', () => {
    const offlineHtmlPath = path.join(rootDir, 'public/offline.html');
    expect(fs.existsSync(offlineHtmlPath)).toBe(true);

    const content = fs.readFileSync(offlineHtmlPath, 'utf-8');
    expect(content).toContain('Loading Daymark Workspace');
  });

  it('configures vite.config.ts with valid PWA manifest parameters', () => {
    const viteConfigPath = path.join(rootDir, 'vite.config.ts');
    expect(fs.existsSync(viteConfigPath)).toBe(true);

    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain("registerType: 'autoUpdate'");
    expect(viteConfigContent).toContain("name: 'Daymark'");
    expect(viteConfigContent).toContain("display: 'standalone'");
    expect(viteConfigContent).toContain("purpose: 'maskable'");
    expect(viteConfigContent).toContain("navigateFallback: 'index.html'");
    expect(viteConfigContent).toContain('devOptions:');
  });

  it('configures index.html with PWA meta tags and links', () => {
    const indexPath = path.join(rootDir, 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);

    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    expect(indexContent).toContain('<meta name="theme-color"');
    expect(indexContent).toContain('<meta name="apple-mobile-web-app-capable"');
    expect(indexContent).toContain('<link rel="apple-touch-icon"');
  });
});
