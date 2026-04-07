
import { _electron as electron } from '@playwright/test';
import { test, expect, ElectronApplication, Page } from '@playwright/test';

let electronApp: ElectronApplication;
let window: Page;

const MOCK_DATABASES = ['ProdDB', 'TestDB'];
const MOCK_CONTAINERS: Record<string, string[]> = {
    'ProdDB': ['Users', 'Orders'],
    'TestDB': ['Logs']
};

const MOCK_RESULTS = [
    { id: '1', name: 'Alice', age: 30, city: 'New York', metadata: { created: '2023-01-01' } },
    { id: '2', name: 'Bob', age: 25, city: 'London', metadata: { created: '2023-01-02' } },
    { id: '3', name: 'Charlie', age: 35, city: 'Paris', metadata: { created: '2023-01-03' } }
];

const setupMocks = async (app: ElectronApplication) => {
    await app.evaluate(({ ipcMain }, { databases, containers, results }) => {
        ['app:getVersion', 'storage:getConnections', 'cosmos:connect', 'cosmos:getContainers', 'storage:getHistory', 'storage:getQueries', 'storage:getTemplates', 'storage:getSchemas', 'storage:getLinks', 'storage:getTranslations', 'cosmos:query', 'compare:open'].forEach(channel => {
            ipcMain.removeHandler(channel);
        });

        ipcMain.handle('app:getVersion', () => '0.9.0-test');
        ipcMain.handle('storage:getConnections', async () => ({ success: true, data: [] }));
        ipcMain.handle('storage:getQueries', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getTemplates', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getSchemas', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getLinks', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getTranslations', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getHistory', async () => ({ success: true, data: [] }));
        
        ipcMain.handle('cosmos:connect', async () => ({
            success: true,
            data: { databases, accountName: 'TestAccount' }
        }));
        
        ipcMain.handle('cosmos:getContainers', async (_, dbId) => ({
            success: true,
            data: containers[dbId] || []
        }));

        ipcMain.handle('cosmos:query', async () => ({
            success: true,
            data: { items: results, hasMoreResults: false }
        }));

        ipcMain.handle('compare:open', async (_, docs) => {
            // Mock compare open
            console.log('Compare opened with:', docs.length, 'docs');
            return { success: true };
        });
    }, { databases: MOCK_DATABASES, containers: MOCK_CONTAINERS, results: MOCK_RESULTS });
};

test.beforeEach(async () => {
    electronApp = await electron.launch({
        args: ['dist-electron/main.js'],
        env: { ...process.env, IS_TEST: 'true' },
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await setupMocks(electronApp);

    // Connect and go to ProdDB/Users
    const connStringInput = window.locator('#conn-string-input');
    await connStringInput.fill('AccountEndpoint=https://test.example.com/;AccountKey=test;');
    await window.getByRole('button', { name: /Connect/i }).click();
    await window.locator('.nav-item', { hasText: 'ProdDB' }).click();
    await window.locator('.container-item-content', { hasText: 'Users' }).click();
    
    // Run initial query to get results
    await window.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(window.locator('#results-text-editor')).toBeVisible();
});

test.afterEach(async () => {
    await electronApp.close();
});

test('view mode switching: Text, Hierarchical, and Template', async () => {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    // Default should be Text view
    await expect(window.locator('#results-text-editor')).toBeVisible();
    await expect(window.locator('#results-text-editor')).toContainText('"name": "Alice"');

    // Switch to Hierarchical (JSON Tree)
    await window.getByRole('button', { name: 'Hierarchical' }).click();
    await expect(window.locator('.json-tree-view')).toBeVisible();
    
    // The results are in an array, so we need to expand the first one (index 0)
    // or just check if it's there.
    await expect(window.locator('.json-node', { hasText: 'root' })).toBeVisible();
    await window.locator('.json-node', { hasText: '0' }).click(); // Expand first item
    await expect(window.locator('.json-node', { hasText: 'Alice' }).first()).toBeVisible();

    // Switch back to Text via keyboard (Cmd+T)
    await window.keyboard.press(`${modifier}+t`);
    await expect(window.locator('#results-text-editor')).toBeVisible();

    // Switch to Template View
    await window.getByRole('button', { name: 'Template' }).click();
    await expect(window.locator('.template-view-container')).toBeVisible();
});

test('search/filter in Text and Hierarchical views', async () => {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    // 1. Text View Search
    await window.keyboard.press(`${modifier}+f`); // Toggle search
    const searchInput = window.locator('.search-bar input');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();

    await searchInput.fill('Alice');
    // Check match count
    await expect(window.locator('.search-match-count')).toContainText('1 matches');

    // 2. Hierarchical View Filter
    await window.getByRole('button', { name: 'Hierarchical' }).click();
    await searchInput.fill('Alice');
    await expect(window.locator('.search-match-count')).toContainText('1 results');
    
    // In Hierarchical view, search filters the top-level results array in ResultsView.tsx
    // So only Alice's document should remain in the array.
    // Index 0 should now be Alice.
    await window.locator('.json-node', { hasText: '0' }).click(); // Expand
    await expect(window.locator('.json-node', { hasText: 'Alice' })).toBeVisible();
    await expect(window.locator('.json-node', { hasText: 'Bob' })).not.toBeVisible();

    // Clear search
    await window.locator('.search-close-btn').click();
    await expect(window.locator('.search-bar')).not.toBeVisible();
    
    // After clearing, all results should be back.
    // The search-match-count should no longer be visible if search is closed,
    // but the results length in metadata should show "3 documents found".
    await expect(window.locator('.results-meta')).toHaveText(/3\+? documents found/);
    
    // Also verify that we can see the index labels for the results
    await expect(window.locator('.json-node', { hasText: '1:' }).first()).toBeVisible(); 
});

test('template view processing', async () => {
    await window.getByRole('button', { name: 'Template' }).click();
    
    const templateInput = window.locator('.template-input');
    await templateInput.fill('User: {name}, City: {city}');
    
    const templateOutput = window.locator('.template-output');
    await expect(templateOutput).toContainText('User: Alice, City: New York');
    await expect(templateOutput).toContainText('User: Bob, City: London');
    await expect(templateOutput).toContainText('User: Charlie, City: Paris');

    // Test nested fields
    await templateInput.fill('Date: {metadata.created}');
    await expect(templateOutput).toContainText('Date: 2023-01-01');
});

test('copy results and compare features', async () => {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    // Mock clipboard
    // Note: Playwright's clipboard support can be tricky in some environments,
    // but let's check if the button is enabled and maybe verify the IPC signal for Save.
    const copyBtn = window.locator('.results-actions .action-btn').first();
    await expect(copyBtn).toBeEnabled();

    // Compare feature (should be visible for 2-5 results)
    const compareBtn = window.locator('.compare-btn');
    await expect(compareBtn).toBeVisible();
    
    // We can't easily verify the child window in this setup without complex multi-window testing,
    // but we can verify the button click doesn't crash and maybe check IPC calls if we track them.
    await compareBtn.click();
    // (In setupMocks we just log it)
});

test('page size selector change', async () => {
    // Intercept with a spy-like mechanism if needed, but here we just check if it triggers a re-query
    // Actually, we can check if it updates the state by checking if a second query was made.
    
    let queryCount = 0;
    let lastPageSize = 0;
    await electronApp.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('cosmos:query');
        ipcMain.handle('cosmos:query', async (_, db, cont, query, pageSize) => {
            // We use a global variable to track calls (poor man's spy in evaluate)
            (global as any).queryCount = ((global as any).queryCount || 0) + 1;
            (global as any).lastPageSize = pageSize;
            return {
                success: true,
                data: { items: [], hasMoreResults: false }
            };
        });
    });

    const pageSizeSelect = window.locator('#page-size-select');
    await pageSizeSelect.selectOption('50');
    
    // Changing page size triggers a re-query if results are already present?
    // Looking at App.tsx, handlePageSizeChange only updates state.
    // User needs to click Run again? 
    // Wait, let's check handlePageSizeChange in App.tsx again.
    /*
    const handlePageSizeChange = (pageSize: number | 'All') => {
        setTabs(prev => prev.map(t =>
            t.id === activeTabId ? { ...t, pageSize } : t
        ));
    };
    */
    // It doesn't seem to trigger a re-query automatically.
    
    await window.getByRole('button', { name: 'Run', exact: true }).click();

    const pageSizeResult = await electronApp.evaluate(() => (global as any).lastPageSize);
    expect(pageSizeResult).toBe(50);
});

test('shortcuts for view switching and results focus', async () => {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    // Start in Hierarchical
    await window.getByRole('button', { name: 'Hierarchical' }).click();
    await expect(window.locator('.json-tree-view')).toBeVisible();

    // Cmd+T -> Text View
    await window.keyboard.press(`${modifier}+t`);
    await expect(window.locator('#results-text-editor')).toBeVisible();

    // Cmd+Shift+T -> Hierarchical View
    await window.keyboard.press(`${modifier}+Shift+t`);
    await expect(window.locator('.json-tree-view')).toBeVisible();

    // Cmd+Alt+T -> Template View
    // On Mac Alt is Option. e2e test might need 'Alt' string.
    await window.keyboard.press(`${modifier}+Alt+t`);
    await expect(window.locator('.template-view-container')).toBeVisible();
});
