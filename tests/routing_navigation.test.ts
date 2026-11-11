import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Navigation & Router Transitions', () => {
  const rootDir = process.cwd();

  it('defines all required page routes and wildcard fallback redirect in App.tsx', () => {
    const appPath = path.join(rootDir, 'src/App.tsx');
    expect(fs.existsSync(appPath)).toBe(true);

    const appContent = fs.readFileSync(appPath, 'utf-8');

    expect(appContent).toContain('TaskDetailsPage');
    expect(appContent).not.toContain('TaskDetailPage');

    // Verify all primary routes exist
    expect(appContent).toContain('path="notes"');
    expect(appContent).toContain('path="notes/:id"');
    expect(appContent).toContain('path="tasks"');
    expect(appContent).toContain('path="tasks/:id"');
    expect(appContent).toContain('path="today"');
    expect(appContent).toContain('path="upcoming"');
    expect(appContent).toContain('path="folders"');
    expect(appContent).toContain('path="archive"');
    expect(appContent).toContain('path="trash"');
    expect(appContent).toContain('path="search"');
    expect(appContent).toContain('path="settings"');
    expect(appContent).toContain('path="*"');
  });

  it('verifies that NavigationSidebar closes mobile drawer on selection', () => {
    const sidebarPath = path.join(rootDir, 'src/components/sidebar/NavigationSidebar.tsx');
    expect(fs.existsSync(sidebarPath)).toBe(true);

    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
    expect(sidebarContent).toContain('onClick={closeMobile}');
  });
});
