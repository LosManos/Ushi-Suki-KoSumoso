
import { _electron as electron } from '@playwright/test';
import { test, expect, ElectronApplication, Page } from '@playwright/test';

let electronApp: ElectronApplication;
let window: Page;

const MOCK_DATABASES = ['DB_1', 'DB_2'];
const MOCK_CONTAINERS: Record<string, string[]> = {
    'DB_1': ['Collection_A1', 'Collection_A2'],
    'DB_2': ['Collection_B1']
};

const setupMocks = async (app: ElectronApplication) => {
    await app.evaluate(({ ipcMain }, { databases, containers }) => {
        ['app:getVersion', 'storage:getConnections', 'cosmos:connect', 'cosmos:getContainers', 'storage:getHistory', 'storage:getQueries', 'storage:getTemplates', 'storage:getSchemas', 'storage:getLinks', 'storage:getTranslations', 'cosmos:getContainerKeys', 'cosmos:getDocument'].forEach(channel => {
            ipcMain.removeHandler(channel);
        });

        ipcMain.handle('app:getVersion', () => '0.9.0-test');
        ipcMain.handle('storage:getConnections', async () => []);
        ipcMain.handle('storage:getQueries', async () => ({ success: true, data: { 'MockAccount/DB_1/Collection_A1': 'SELECT * FROM c' } }));
        ipcMain.handle('storage:getTemplates', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getSchemas', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getLinks', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getTranslations', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getHistory', async () => ({ success: true, data: [] }));
        
        ipcMain.handle('cosmos:connect', async () => ({
            success: true,
            data: { databases, accountName: 'MockAccount' }
        }));
        
        ipcMain.handle('cosmos:getContainers', async (_, dbId) => ({
            success: true,
            data: containers[dbId] || []
        }));

        ipcMain.handle('cosmos:getContainerKeys', async () => ({
            success: true,
            data: ['id', 'name', 'age', 'address.city']
        }));

        ipcMain.handle('cosmos:getDocument', async (_, db, cont, id) => ({
            success: true,
            data: { id, name: 'Mock Document', db, cont }
        }));
    }, { databases: MOCK_DATABASES, containers: MOCK_CONTAINERS });
};

test.beforeEach(async () => {
    electronApp = await electron.launch({
        args: ['dist-electron/main.js'],
        env: { ...process.env, IS_TEST: 'true' },
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await setupMocks(electronApp);

    // Perform connection
    const connStringInput = window.getByPlaceholder(/AccountEndpoint=...;AccountKey=.../i);
    await connStringInput.fill('AccountEndpoint=https://mock.example.com/;AccountKey=mock;');
    await window.getByRole('button', { name: /Connect/i }).click();
    await expect(window.locator('.nav-item', { hasText: 'DB_1' })).toBeVisible();
});

test.afterEach(async () => {
    await electronApp.close();
});

test('cmd-p opens command palette with fuzzy search and collection selection', async () => {
    // Open palette
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await window.keyboard.press(`${modifier}+p`);

    const palette = window.locator('.command-palette');
    await expect(palette).toBeVisible();

    const input = palette.locator('input.command-palette-input');
    await expect(input).toBeFocused();

    // Fuzzy search for "A2"
    await input.fill('A2');
    await expect(palette.locator('.command-palette-item', { hasText: 'Collection_A2' })).toBeVisible();
    await expect(palette.locator('.command-palette-item', { hasText: 'Collection_A1' })).not.toBeVisible();

    // Select it
    await window.keyboard.press('Enter');
    await expect(palette).not.toBeVisible();

    // Verify tab and editor
    await expect(window.locator('.tab.active', { hasText: 'Collection_A2' })).toBeVisible();
});

test('tabs have tooltips and keyboard navigation (Cmd+1-9, Ctrl+Tab)', async () => {
    // Open three collections
    await window.locator('.db-item > .nav-item', { hasText: 'DB_1' }).click();
    await window.locator('.container-item-content', { hasText: 'Collection_A1' }).click();
    await window.locator('.container-item-content', { hasText: 'Collection_A2' }).click();
    
    await window.locator('.db-item > .nav-item', { hasText: 'DB_2' }).click();
    await window.locator('.container-item-content', { hasText: 'Collection_B1' }).click();

    const tabs = window.locator('.tab');
    await expect(tabs).toHaveCount(3);

    // Check tooltips
    await expect(tabs.nth(0)).toHaveAttribute('title', 'DB_1 / Collection_A1 (Cmd+1)');
    await expect(tabs.nth(1)).toHaveAttribute('title', 'DB_1 / Collection_A2 (Cmd+2)');
    await expect(tabs.nth(2)).toHaveAttribute('title', 'DB_2 / Collection_B1 (Cmd+3)');

    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    // Navigate to second tab (Cmd+2)
    await window.keyboard.press(`${modifier}+2`);
    await expect(tabs.nth(1)).toHaveClass(/active/);

    // Navigate to first tab (Cmd+1)
    await window.keyboard.press(`${modifier}+1`);
    await expect(tabs.nth(0)).toHaveClass(/active/);

    // Navigate to last tab (Cmd+9)
    await window.keyboard.press(`${modifier}+9`);
    await expect(tabs.nth(2)).toHaveClass(/active/);

    // Ctrl+Tab navigation (Next)
    // Note: Playwright doesn't always handle Ctrl+Tab perfectly in all OS, but let's try
    await window.keyboard.press('Control+Tab');
    await expect(tabs.nth(0)).toHaveClass(/active/); // Round robin from 2 to 0

    // Shift+Ctrl+Tab (Previous)
    await window.keyboard.down('Shift');
    await window.keyboard.press('Control+Tab');
    await window.keyboard.up('Shift');
    await expect(tabs.nth(2)).toHaveClass(/active/); // Round robin from 0 to 2
});

test('property dropdown discovery and append feature', async () => {
    await window.locator('.db-item > .nav-item', { hasText: 'DB_1' }).click();
    await window.locator('.container-item-content', { hasText: 'Collection_A1' }).click();

    const propSelect = window.locator('select.property-select');
    await expect(propSelect).toHaveAttribute('title', /Filter by property/);

    // Discover schema
    await propSelect.selectOption({ label: 'Initialize Properties...' });
    
    // Wait for options to populate (id, name, age, address.city)
    // Instead of toBeVisible which can fail for options in some drivers, 
    // we wait for the option to be attached and have text.
    const cityOption = propSelect.locator('option', { hasText: 'address.city' });
    await expect(cityOption).toBeAttached();

    // Select "age"
    await propSelect.selectOption('age');
    
    // Enter value
    const valueInput = window.locator('input.property-value-input');
    await expect(valueInput).toHaveAttribute('title', 'Property value');
    await valueInput.fill('42');

    // Click append
    await window.getByRole('button', { name: 'Append' }).click();

    // Verify editor content (it should contain the appended query)
    const editor = window.locator('#query-editor-textarea');
    await expect(editor).toContainText('SELECT * FROM c WHERE c["age"] = 42');
});

test('get by document id feature', async () => {
    await window.locator('.db-item > .nav-item', { hasText: 'DB_1' }).click();
    await window.locator('.container-item-content', { hasText: 'Collection_A1' }).click();

    const idInput = window.getByPlaceholder('Quick ID Lookup...');
    await expect(idInput).toHaveAttribute('title', /Focus ID Lookup/);
    
    await idInput.fill('test-id-123');
    await window.getByRole('button', { name: 'Get' }).click();

    // Verify results show the document in the default Text view
    const resultsEditor = window.locator('#results-text-editor');
    await expect(resultsEditor).toBeVisible();
    await expect(resultsEditor).toContainText('"id": "test-id-123"');
    await expect(resultsEditor).toContainText('"name": "Mock Document"');
});
