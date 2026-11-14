import { expect, test } from '@playwright/test';

test('serves the installable shell and principal routes at the target viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Daymark/);

  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifest).toBeTruthy();
  const manifestResponse = await page.request.get(manifest!);
  expect(manifestResponse.ok()).toBeTruthy();
  const manifestData = await manifestResponse.json() as {
    name: string;
    display: string;
    start_url: string;
    icons: Array<{ src: string; sizes: string }>;
  };
  expect(manifestData.name).toBe('Daymark');
  expect(manifestData.display).toBe('standalone');
  expect(manifestData.start_url).toBe('/');
  expect(manifestData.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
  expect(manifestData.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
  for (const icon of manifestData.icons) {
    expect((await page.request.get(icon.src)).ok()).toBeTruthy();
  }

  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are unavailable.');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const workerAndCache = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const assetUrls = Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[rel="stylesheet"]'))
      .map((element) => element instanceof HTMLScriptElement ? element.src : element.href);
    const cacheNames = await caches.keys();
    const cachedAssets = await Promise.all(assetUrls.map(async (url) => {
      const response = await caches.match(url);
      return Boolean(response);
    }));
    return {
      activeWorker: Boolean(registration?.active),
      controlled: Boolean(navigator.serviceWorker.controller),
      cacheNames,
      cachedAssetCount: cachedAssets.filter(Boolean).length,
      appAssetCount: assetUrls.length,
    };
  });
  expect(workerAndCache.activeWorker).toBe(true);
  expect(workerAndCache.controlled).toBe(true);
  expect(workerAndCache.cacheNames.length).toBeGreaterThan(0);
  expect(workerAndCache.cachedAssetCount).toBeGreaterThan(0);
  expect(workerAndCache.appAssetCount).toBeGreaterThan(0);

  for (const [route, heading] of [
    ['/notes', 'All Notes'],
    ['/tasks', 'All Tasks'],
    ['/folders', 'Folders'],
    ['/archive', 'Archive'],
    ['/trash', 'Trash'],
    ['/search', 'Search'],
    ['/settings', 'Application Settings'],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  }

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test('creates a task locally and retains it through an offline production-shell relaunch', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'New Task' }).click();
  await page.getByPlaceholder('e.g. Audit IndexedDB storage & transactions').fill('Offline audit task');
  await page.getByRole('button', { name: 'Create Task' }).click();
  await expect(page.getByText('Offline audit task')).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'All Tasks' })).toBeVisible();
  await expect(page.getByText('Offline audit task')).toBeVisible();
});

test('confirms task completion offline, supports cancellation, and keeps completed tasks in All Tasks', async ({ page, context }) => {
  const taskTitle = `Confirm completion ${Date.now()}`;
  const countTaskOutboxOperations = async () => page.evaluate((title) => new Promise<number>((resolve, reject) => {
    const opening = indexedDB.open('DaymarkDB');
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const database = opening.result;
      const tasksRequest = database.transaction('tasks', 'readonly').objectStore('tasks').getAll();
      tasksRequest.onerror = () => reject(tasksRequest.error);
      tasksRequest.onsuccess = () => {
        const task = tasksRequest.result.find((item) => item.title === title);
        if (!task) {
          reject(new Error('Task was not persisted.'));
          database.close();
          return;
        }
        const outboxRequest = database.transaction('outbox', 'readonly').objectStore('outbox').getAll();
        outboxRequest.onerror = () => reject(outboxRequest.error);
        outboxRequest.onsuccess = () => {
          resolve(outboxRequest.result.filter((operation) => operation.entityId === task.id).length);
          database.close();
        };
      };
    };
  }), taskTitle);

  await page.goto('/');
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
  });
  await page.reload();
  const completedTasksStat = page.getByRole('region', { name: 'Completed tasks' });

  await page.goto('/tasks');
  await page.getByRole('button', { name: 'New Task' }).click();
  await page.getByPlaceholder('e.g. Audit IndexedDB storage & transactions').fill(taskTitle);
  await page.getByRole('button', { name: 'Create Task' }).click();
  const completedBefore = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const opening = indexedDB.open('DaymarkDB');
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const database = opening.result;
      const tasksRequest = database.transaction('tasks', 'readonly').objectStore('tasks').getAll();
      tasksRequest.onerror = () => reject(tasksRequest.error);
      tasksRequest.onsuccess = () => {
        resolve(tasksRequest.result.filter((task) => task.isCompleted && task.deletedAt === null).length);
        database.close();
      };
    };
  }));
  await page.goto('/');
  await expect(completedTasksStat.locator('p').nth(1)).toHaveText(String(completedBefore));
  await page.goto('/tasks');
  await context.setOffline(true);

  const completeCheckbox = page.getByRole('checkbox', {
    name: `Mark task "${taskTitle}" as completed`,
  });
  await completeCheckbox.click();
  const dialog = page.getByRole('dialog', { name: 'Complete this task?' });
  await expect(dialog).toContainText(
    'Are you sure you want to mark this task as completed? It will be moved to All Tasks.'
  );
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const dialogPosition = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2,
      viewportCenterX: window.innerWidth / 2,
      viewportCenterY: window.innerHeight / 2,
    };
  });
  expect(Math.abs(dialogPosition.centerX - dialogPosition.viewportCenterX)).toBeLessThanOrEqual(1);
  expect(Math.abs(dialogPosition.centerY - dialogPosition.viewportCenterY)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(completeCheckbox).not.toBeChecked();

  await completeCheckbox.click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(completeCheckbox).not.toBeChecked();

  await completeCheckbox.click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const reopenCheckbox = page.getByRole('checkbox', {
    name: `Reopen task "${taskTitle}"`,
  });
  await expect(reopenCheckbox).toBeChecked();
  await expect(page.getByRole('heading', { name: /Completed Tasks/ })).toBeVisible();
  expect(await countTaskOutboxOperations()).toBe(2);

  await reopenCheckbox.click();
  const reopenDialog = page.getByRole('dialog', { name: 'Reopen this task?' });
  await expect(reopenDialog).toContainText(
    'Are you sure you want to mark this task as incomplete? It will return to your active tasks.'
  );
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(reopenCheckbox).toBeChecked();
  expect(await countTaskOutboxOperations()).toBe(2);

  await reopenCheckbox.click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(completeCheckbox).not.toBeChecked();
  expect(await countTaskOutboxOperations()).toBe(3);

  await context.setOffline(false);
  await page.goto('/');
  await expect(completedTasksStat.locator('p').nth(1)).toHaveText(String(completedBefore));
});

test('blocks parent completion offline until all subtasks are complete', async ({ page, context }) => {
  const taskTitle = `Parent task ${Date.now()}`;
  const subtaskTitle = 'Finish required checklist';

  await page.goto('/');
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'New Task' }).click();
  await page.getByPlaceholder('e.g. Audit IndexedDB storage & transactions').fill(taskTitle);
  await page.getByPlaceholder('Add a subtask item...').fill(subtaskTitle);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Create Task' }).click();
  await expect(page.getByText(taskTitle, { exact: true })).toBeVisible();
  await context.setOffline(true);

  const parentCheckbox = page.getByRole('checkbox', {
    name: `Mark task "${taskTitle}" as completed`,
  });
  await parentCheckbox.click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  const confirmationDialog = page.getByRole('dialog', { name: 'Complete this task?' });
  await expect(confirmationDialog).toBeHidden();
  const warningDialog = page.getByRole('dialog', { name: 'Subtasks still pending' });
  await expect(warningDialog).toContainText(
    'Complete all subtasks before marking this task as completed.'
  );
  await expect(warningDialog).toContainText('1 incomplete subtask remaining.');
  await expect(warningDialog).toContainText('This action will not complete subtasks automatically.');
  await expect(warningDialog.getByRole('button')).toHaveCount(1);
  await expect(warningDialog.getByRole('button', { name: 'OK' })).toBeVisible();
  await warningDialog.getByRole('button', { name: 'OK' }).click();
  await expect(warningDialog).toBeHidden();
  await expect(confirmationDialog).toBeHidden();
  await expect(parentCheckbox).not.toBeChecked();

  await page.getByText(taskTitle, { exact: true }).click();
  await expect(page.getByRole('heading', { name: taskTitle })).toBeVisible();
  const subtaskCheckbox = page.getByRole('checkbox', { name: subtaskTitle });
  await expect(subtaskCheckbox).not.toBeChecked();
  await subtaskCheckbox.click();
  await expect(subtaskCheckbox).toBeChecked();
  await page.getByRole('button', { name: 'Back to All Tasks' }).click();

  await parentCheckbox.click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: `Reopen task "${taskTitle}"` })
  ).toBeChecked();
  await expect(page.getByRole('heading', { name: /Completed Tasks/ })).toBeVisible();
  await expect(page.getByText(taskTitle, { exact: true })).toBeVisible();
});

test('shows due tasks, status, and saved visibility on the productivity calendar', async ({ page }) => {
  const taskPrefix = `Productivity calendar ${Date.now()}`;
  const dates = await page.evaluate(() => {
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const today = new Date();
    return {
      today: formatDate(today),
      todayLabel: new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(today),
      currentMonth: new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
      }).format(today),
      nextMonth: new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(today.getFullYear(), today.getMonth() + 1, 1)),
    };
  });
  const pendingTask = `${taskPrefix} high pending`;
  const completedTask = `${taskPrefix} completed`;

  const createTask = async (title: string, status: string, priority: string) => {
    await page.goto('/tasks');
    await page.getByRole('button', { name: 'New Task' }).click();
    await page.getByPlaceholder('e.g. Audit IndexedDB storage & transactions').fill(title);
    await page.locator('input[type="date"]').last().fill(dates.today);
    await page.locator('form select').nth(0).selectOption(status);
    await page.locator('form select').nth(1).selectOption(priority);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  };

  await createTask(pendingTask, 'todo', 'high');
  await createTask(completedTask, 'completed', 'medium');

  await page.goto('/settings');
  const visibilityToggle = page.getByRole('checkbox', {
    name: 'Show task deadlines on the Productivity Calendar',
  });
  await expect(visibilityToggle).toBeEnabled();
  await expect(visibilityToggle).toBeChecked();
  await page.goto('/');
  const visibleCalendar = page
    .getByRole('heading', { name: 'Productivity calendar', exact: true })
    .locator('xpath=ancestor::section[1]');
  const monthHeading = visibleCalendar.getByRole('heading', { level: 3 });
  await expect(monthHeading).toHaveText(dates.currentMonth);
  const visibleTodayCell = visibleCalendar.locator(`button[aria-label^="${dates.todayLabel}:"]`);
  await expect(visibleTodayCell).toHaveAttribute('aria-label', /\d+ tasks? due/);
  await visibleTodayCell.click();
  const visiblePopover = page.locator('[role="dialog"]');
  await expect(visiblePopover.getByText(/\d+ tasks? due/)).toBeVisible();
  const pendingTaskButton = visiblePopover.getByRole('button', { name: new RegExp(pendingTask) });
  const completedTaskButton = visiblePopover.getByRole('button', { name: new RegExp(completedTask) });
  await expect(pendingTaskButton).toBeVisible();
  await expect(completedTaskButton).toBeVisible();
  await expect(pendingTaskButton.getByText('High priority', { exact: true })).toBeVisible();
  await expect(completedTaskButton.getByText('Completed', { exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await visibleCalendar.getByRole('button', { name: 'Next month' }).click();
  await expect(monthHeading).toHaveText(dates.nextMonth);
  await visibleCalendar.getByRole('button', { name: 'Previous month' }).click();
  await expect(monthHeading).toHaveText(dates.currentMonth);
  await visibleTodayCell.click();
  await expect(visiblePopover).toBeVisible();
  await page.locator('h1').click();
  await expect(visiblePopover).toBeHidden();

  await page.goto('/settings');
  await visibilityToggle.click();
  await expect(visibilityToggle).not.toBeChecked();
  await expect(visibilityToggle).toBeEnabled();
  await page.goto('/');
  const hiddenCalendar = page
    .getByRole('heading', { name: 'Productivity calendar', exact: true })
    .locator('xpath=ancestor::section[1]');
  const hiddenTodayCell = hiddenCalendar.locator(`button[aria-label^="${dates.todayLabel}:"]`);
  await hiddenTodayCell.click();
  const hiddenPopover = page.locator('[role="dialog"]');
  await expect(hiddenPopover.getByText(/Task deadlines are hidden/)).toBeVisible();
  await expect(hiddenPopover.getByText(pendingTask, { exact: true })).toHaveCount(0);

  await page.goto('/settings');
  await expect(visibilityToggle).not.toBeChecked();
});

test('navigates deadline dates and shows scheduled, completed, overdue, and priority states', async ({ page }) => {
  const taskPrefix = `Deadline calendar ${Date.now()}`;
  const dates = await page.evaluate(() => {
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const today = new Date();
    return {
      yesterday: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)),
      today: formatDate(today),
      future: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)),
    };
  });

  const createTask = async (title: string, dueDate?: string, status?: string, priority?: string) => {
    await page.goto('/tasks');
    await page.getByRole('button', { name: 'New Task' }).click();
    await page.getByPlaceholder('e.g. Audit IndexedDB storage & transactions').fill(title);
    if (dueDate) await page.locator('input[type="date"]').last().fill(dueDate);
    const selects = page.locator('form select');
    if (status) await selects.nth(0).selectOption(status);
    if (priority) await selects.nth(1).selectOption(priority);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  };

  const futureTask = `${taskPrefix} high pending`;
  const completedTask = `${taskPrefix} completed`;
  const overdueTask = `${taskPrefix} overdue`;
  const undatedTask = `${taskPrefix} no date`;
  await createTask(futureTask, dates.future, undefined, 'high');
  await createTask(completedTask, dates.future, 'completed');
  await createTask(overdueTask, dates.yesterday);
  await createTask(undatedTask);

  await page.goto('/upcoming');
  const dateInput = page.getByRole('textbox', { name: 'Select deadline date' });
  await dateInput.fill(dates.future);
  await expect(page.getByText(futureTask, { exact: true })).toBeVisible();
  await expect(page.getByText(completedTask, { exact: true })).toBeVisible();
  await expect(page.getByText(undatedTask, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('checkbox', { name: `Reopen task "${completedTask}"` })
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: `Mark task "${futureTask}" as completed` })
  ).toBeVisible();
  await expect(page.getByText('High', { exact: true }).first()).toBeVisible();

  for (let day = 0; day < 4; day += 1) {
    await page.getByRole('button', { name: 'Previous day' }).click();
  }
  await expect(dateInput).toHaveValue(dates.yesterday);
  await expect(page.getByText(overdueTask, { exact: true })).toBeVisible();
  await expect(page.getByText(/Overdue/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Today' }).click();
  await expect(dateInput).toHaveValue(dates.today);
  await expect(page.getByText(undatedTask, { exact: true })).toHaveCount(0);
});

test('creates and saves a note in IndexedDB for offline reload', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New Note' }).click();
  await page.getByPlaceholder('Untitled Note').fill('Offline audit note');
  await expect(page.getByText('✓ Saved locally')).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByPlaceholder('Untitled Note')).toHaveValue('Offline audit note');
});
