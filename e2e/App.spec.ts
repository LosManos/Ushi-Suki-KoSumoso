/**
 * MANDATORY: All database and IPC interactions MUST be mocked using electronApp.evaluate().
 * DO NOT ATTEMPT TO CONNECT TO A REAL COSMOS DB INSTANCE.
 * See .agent/workflows/e2e-testing.md for detailed instructions.
 */
import { _electron as electron } from '@playwright/test';
import { test, expect, ElectronApplication, Page } from '@playwright/test';

let electronApp: ElectronApplication;
let window: Page;

test.beforeEach(async () => {
  electronApp = await electron.launch({
    args: ['dist-electron/main.js'],
    env: { ...process.env, IS_TEST: 'true' },
  });
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // MOCK CORE (Remove existing handlers first)
  await electronApp.evaluate(({ ipcMain }) => {
    ['app:getVersion', 'storage:getConnections', 'cosmos:connect', 'cosmos:getContainers'].forEach(channel => {
        ipcMain.removeHandler(channel);
    });
    
    ipcMain.handle('app:getVersion', () => '0.9.0-test');
    ipcMain.handle('storage:getConnections', async () => []);
  });
});

test.afterEach(async () => {
  await electronApp.close();
});

test('starts on empty connection form', async () => {
  await expect(window.locator('h2', { hasText: 'Kosumoso' })).toBeVisible();
  await expect(window.getByPlaceholder(/AccountEndpoint=...;AccountKey=.../i)).toBeVisible();
});

test('can connect and navigate using mocked database', async () => {
  await electronApp.evaluate(({ ipcMain }) => {
    ipcMain.handle('cosmos:connect', async () => ({ 
        success: true, 
        data: { databases: ['E2E_Mock_DB'], accountName: 'MockAccount' } 
    }));
    ipcMain.handle('cosmos:getContainers', async () => ({ 
        success: true, 
        data: ['MockContainer_A', 'MockContainer_B'] 
    }));
  });

  const connStringInput = window.getByPlaceholder(/AccountEndpoint=...;AccountKey=.../i);
  await connStringInput.fill('AccountEndpoint=https://mock.example.com/;AccountKey=mock;');
  await window.getByRole('button', { name: /Connect/i }).click();

  await expect(window.locator('.nav-item', { hasText: 'E2E_Mock_DB' })).toBeVisible();
  await window.locator('.nav-item', { hasText: 'E2E_Mock_DB' }).click();
  await expect(window.locator('.nav-item', { hasText: 'MockContainer_A' })).toBeVisible();
});


