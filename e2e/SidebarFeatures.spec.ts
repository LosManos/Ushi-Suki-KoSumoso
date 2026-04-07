
import { _electron as electron } from '@playwright/test';
import { test, expect, ElectronApplication, Page } from '@playwright/test';

let electronApp: ElectronApplication;
let window: Page;

const MOCK_HISTORY = [
    {
        id: '1',
        accountName: 'MockAccount',
        databaseId: 'DB_1',
        containerId: 'Collection_A',
        query: 'SELECT * FROM c WHERE c.name = "Alice" AND c.age > 30 AND c.city = "Stockholm" AND c.active = true',
        timestamp: Date.now()
    },
    {
        id: '2',
        accountName: 'MockAccount',
        databaseId: 'DB_2',
        containerId: 'Collection_B',
        query: 'SELECT TOP 10 * FROM c ORDER BY c._ts DESC',
        timestamp: Date.now() - 1000
    }
];

test.beforeEach(async () => {
    electronApp = await electron.launch({
        args: ['dist-electron/main.js'],
        env: { ...process.env, IS_TEST: 'true' },
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // MOCK CORE (Remove existing handlers first)
    await electronApp.evaluate(({ ipcMain }) => {
        ['app:getVersion', 'storage:getConnections', 'cosmos:connect', 'cosmos:getContainers', 'storage:getHistory', 'storage:getQueries', 'storage:getTemplates', 'storage:getSchemas', 'storage:getLinks', 'storage:getTranslations'].forEach(channel => {
            ipcMain.removeHandler(channel);
        });

        ipcMain.handle('app:getVersion', () => '0.9.0-test');
        ipcMain.handle('storage:getConnections', async () => []);
        ipcMain.handle('storage:getQueries', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getTemplates', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getSchemas', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getLinks', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getTranslations', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getHistory', async () => ({ success: true, data: [] }));
    });
});

test.afterEach(async () => {
    await electronApp.close();
});

test('sidebar shows databases and collections', async () => {
    await electronApp.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('cosmos:connect');
        ipcMain.handle('cosmos:connect', async () => ({
            success: true,
            data: { databases: ['DB_1', 'DB_2'], accountName: 'MockAccount' }
        }));
        ipcMain.removeHandler('cosmos:getContainers');
        ipcMain.handle('cosmos:getContainers', async (_, dbId) => ({
            success: true,
            data: dbId === 'DB_1' ? ['Collection_A', 'Collection_B'] : ['Collection_C']
        }));
    });

    // Fill connection string and click connect
    const connStringInput = window.getByPlaceholder(/AccountEndpoint=...;AccountKey=.../i);
    await connStringInput.fill('AccountEndpoint=https://mock.example.com/;AccountKey=mock;');
    await window.getByRole('button', { name: /Connect/i }).click();

    // Verify databases are shown
    await expect(window.locator('.db-item > .nav-item', { hasText: 'DB_1' })).toBeVisible();
    await expect(window.locator('.db-item > .nav-item', { hasText: 'DB_2' })).toBeVisible();

    // Expand DB_1
    await window.locator('.db-item > .nav-item', { hasText: 'DB_1' }).click();
    await expect(window.locator('.container-item-content', { hasText: 'Collection_A' })).toBeVisible();
    await expect(window.locator('.container-item-content', { hasText: 'Collection_B' })).toBeVisible();
});

test('cached queries visible before selecting a database and show names', async () => {
    await electronApp.evaluate(({ ipcMain }, history) => {
        ipcMain.removeHandler('storage:getHistory');
        ipcMain.handle('storage:getHistory', async () => ({ success: true, data: history }));
        
        ipcMain.removeHandler('cosmos:connect');
        ipcMain.handle('cosmos:connect', async () => ({
            success: true,
            data: { databases: ['DB_1'], accountName: 'MockAccount' }
        }));
    }, MOCK_HISTORY);

    // Reload window
    await window.reload();
    await window.waitForLoadState('domcontentloaded');

    // Connect
    await window.getByPlaceholder(/AccountEndpoint=...;AccountKey=.../i).fill('AccountEndpoint=https://mock.example.com/;AccountKey=mock;');
    await window.getByRole('button', { name: /Connect/i }).click();

    // Wait for history items to load
    const historyItem = window.locator('.history-item').first();
    await expect(historyItem).toBeVisible();

    // Before selecting any database, history meta should show database/collection
    await expect(historyItem.locator('.history-meta')).toContainText('DB_1/Collection_A');

    // Tooltip should be populated
    const title = await historyItem.getAttribute('title');
    expect(title).toContain('SELECT * FROM c WHERE c.name = "Alice"');
});

test('cached queries visible when collection chosen (no meta name shown)', async () => {
    await electronApp.evaluate(({ ipcMain }, history) => {
        ipcMain.removeHandler('storage:getHistory');
        ipcMain.handle('storage:getHistory', async () => ({ success: true, data: history }));
        
        ipcMain.removeHandler('cosmos:connect');
        ipcMain.handle('cosmos:connect', async () => ({
            success: true,
            data: { databases: ['DB_1'], accountName: 'MockAccount' }
        }));
        ipcMain.removeHandler('cosmos:getContainers');
        ipcMain.handle('cosmos:getContainers', async () => ({
            success: true,
            data: ['Collection_A']
        }));
    }, MOCK_HISTORY);

    // Reload window
    await window.reload();
    await window.waitForLoadState('domcontentloaded');

    // Connect
    await window.getByPlaceholder(/AccountEndpoint=...;AccountKey=.../i).fill('AccountEndpoint=https://mock.example.com/;AccountKey=mock;');
    await window.getByRole('button', { name: /Connect/i }).click();

    // Select DB_1 then Collection_A
    await window.locator('.db-item > .nav-item', { hasText: 'DB_1' }).click();
    await window.locator('.container-item-content', { hasText: 'Collection_A' }).click();

    // Verify history item for Collection_A is first
    const historyItem = window.locator('.history-item').first();
    await expect(historyItem).toBeVisible();

    // The collection name meta should NOT be visible because we have chosen it
    await expect(historyItem.locator('.history-meta')).not.toBeVisible();

    // Tooltip check
    const title = await historyItem.getAttribute('title');
    expect(title).toContain('SELECT * FROM c WHERE c.name = "Alice"');
});

test('sidebar dropdown allows filtering cached queries', async () => {
    await electronApp.evaluate(({ ipcMain }, history) => {
        ipcMain.removeHandler('storage:getHistory');
        ipcMain.handle('storage:getHistory', async () => ({ success: true, data: history }));
        
        ipcMain.removeHandler('cosmos:connect');
        ipcMain.handle('cosmos:connect', async () => ({
            success: true,
            data: { databases: ['DB_1', 'DB_2'], accountName: 'MockAccount' }
        }));
    }, MOCK_HISTORY);

    // Reload window
    await window.reload();
    await window.waitForLoadState('domcontentloaded');

    // Connect
    await window.getByPlaceholder(/AccountEndpoint=...;AccountKey=.../i).fill('AccountEndpoint=https://mock.example.com/;AccountKey=mock;');
    await window.getByRole('button', { name: /Connect/i }).click();

    // Open filter dropdown
    await window.locator('.history-filter-button').click();
    await expect(window.locator('.history-filter-options')).toBeVisible();

    // Select "DB_2/Collection_B"
    await window.locator('.history-filter-option', { hasText: 'DB_2' }).click();

    // Now only 1 item should be visible
    await expect(window.locator('.history-item')).toHaveCount(1);
    // Meta should be hidden because filter matches the item perfectly
    await expect(window.locator('.history-item').locator('.history-meta')).not.toBeVisible();
});
