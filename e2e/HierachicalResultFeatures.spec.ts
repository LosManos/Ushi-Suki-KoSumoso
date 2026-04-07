
import { _electron as electron } from '@playwright/test';
import { test, expect, ElectronApplication, Page } from '@playwright/test';

let electronApp: ElectronApplication;
let window: Page;

const MOCK_DATABASES = ['ProdDB'];
const MOCK_CONTAINERS: Record<string, string[]> = {
    'ProdDB': ['Users', 'Orders']
};

const MOCK_RESULTS = [
    { id: '1', name: 'Alice', status: 1, _ts: 1672531200 }, // 2023-01-01
    { id: '2', name: 'Bob', status: 0, _ts: 1672617600 }    // 2023-01-02
];

const setupComplexMocks = async (app: ElectronApplication) => {
    await app.evaluate(({ ipcMain }, { databases, containers, results }) => {
        ['app:getVersion', 'storage:getConnections', 'cosmos:connect', 'cosmos:getContainers', 'storage:getHistory', 'storage:getQueries', 'storage:getTemplates', 'storage:getSchemas', 'storage:getLinks', 'storage:saveLinks', 'storage:getTranslations', 'cosmos:query', 'compare:open'].forEach(channel => {
            ipcMain.removeHandler(channel);
        });

        ipcMain.handle('app:getVersion', () => '0.9.0-test');
        ipcMain.handle('storage:getConnections', async () => ({ success: true, data: [] }));
        ipcMain.handle('storage:getQueries', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getTemplates', async () => ({ success: true, data: {} }));
        ipcMain.handle('storage:getSchemas', async () => ({ success: true, data: {} }));

        ipcMain.handle('storage:getLinks', async () => ({
            success: true,
            data: {
                'TestAccount/ProdDB/Users:status': {
                    targetDb: 'ProdDB',
                    targetContainer: 'Statuses',
                    targetPropertyName: 'code'
                }
            }
        }));

        ipcMain.handle('storage:saveLinks', async (_, links) => ({
            success: true,
            data: links
        }));

        ipcMain.handle('storage:getTranslations', async () => ({
            success: true,
            data: {
                'TestAccount': {
                    'ProdDB': {
                        'Users': {
                            'status': {
                                '0': 'Inactive',
                                '1': 'Active'
                            }
                        }
                    }
                }
            }
        }));

        ipcMain.handle('storage:getHistory', async () => ({ success: true, data: [] }));

        ipcMain.handle('cosmos:connect', async () => ({
            success: true,
            data: { databases, accountName: 'TestAccount' }
        }));

        ipcMain.handle('cosmos:getContainers', async (_, dbId) => ({
            success: true,
            data: containers[dbId] || []
        }));

        ipcMain.handle('cosmos:query', async (_, db, container, query) => {
            if (query && query.includes('WHERE c["code"] = 1')) {
                // Link result: singleton to trigger auto-expand
                return {
                    success: true,
                    data: { items: [{ id: 'link_1', name: 'Linked Alice' }], hasMoreResults: false }
                };
            }
            if (query && query.includes('WHERE c["id"] = "Alice"')) {
                return {
                    success: true,
                    data: { items: [{ id: 'new_link_1', name: 'Newly Linked Alice' }], hasMoreResults: false }
                };
            }
            return {
                success: true,
                data: { items: results, hasMoreResults: false }
            };
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
    await setupComplexMocks(electronApp);

    // Reload to ensure startup mocks are loaded
    await window.reload();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('#conn-string-input').fill('AccountEndpoint=https://test.example.com/;AccountKey=test;');
    await window.getByRole('button', { name: /Connect/i }).click();
    await window.locator('.nav-item', { hasText: 'ProdDB' }).click();
    await window.locator('.container-item-content', { hasText: 'Users' }).click();

    await window.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(window.locator('#results-text-editor')).toBeVisible();
});

test.afterEach(async () => {
    await electronApp.close();
});

test('hierarchical view navigation and expansion', async () => {
    await window.getByRole('button', { name: 'Hierarchical' }).click();
    await expect(window.locator('.json-tree-view')).toBeVisible();
    await window.locator('.json-tree-view').click();

    await window.keyboard.press('ArrowDown'); // move to 0
    await expect(window.locator('[id="json-node-root.0"]')).toBeVisible();

    await window.keyboard.press('ArrowRight'); // expand 0
    await expect(window.locator('[id="json-node-root.0.name"]')).toBeVisible();

    await window.keyboard.press('ArrowDown'); // move to name
    await window.keyboard.press('ArrowDown'); // move to status
    await expect(window.locator('[id="json-node-root.0.status"]')).toBeVisible();

    await window.keyboard.press('ArrowUp'); // back up
    await window.keyboard.press('ArrowUp'); // back up
    await window.keyboard.press('Alt+ArrowRight'); // Expand Level (0 and 1)
    await expect(window.locator('[id="json-node-root.1.name"]')).toBeVisible();
});

test('property isolation feature', async () => {
    await window.getByRole('button', { name: 'Hierarchical' }).click();
    await window.locator('[id="json-node-root.0"]').click();

    const statusNode = window.locator('[id="json-node-root.0.status"]');
    await statusNode.click();
    await window.keyboard.press('Alt+w');

    await expect(window.locator('.filter-banner')).toBeVisible();
    await expect(window.locator('[id="json-node-root.0.name"]')).not.toBeVisible();

    await window.keyboard.press('Escape');
    await expect(window.locator('.filter-banner')).not.toBeVisible();
    await expect(window.locator('[id="json-node-root.0.name"]')).toBeVisible();
});

test('copy shortcuts work without error', async () => {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    await window.locator('#results-text-editor').click();
    await window.keyboard.press('ArrowDown');
    await window.keyboard.press('Alt+k');

    await window.getByRole('button', { name: 'Hierarchical' }).click();
    await window.locator('[id="json-node-root.0"]').click();
    await window.locator('[id="json-node-root.0.name"]').click();
    await window.keyboard.press('Alt+k');

    await window.keyboard.press(`${modifier}+Shift+s`);
});

test('follow link feature navigation (existing link)', async () => {
    await window.getByRole('button', { name: 'Hierarchical' }).click();
    await window.locator('[id="json-node-root.0"]').click(); // Expand 0

    const statusNode = window.locator('[id="json-node-root.0.status"]');
    const linkIndicator = statusNode.locator('.json-link-indicator');
    await expect(linkIndicator).toBeVisible();

    // Existing link follows immediately on click
    await linkIndicator.click();
    await expect(statusNode.locator('.json-linked-original')).toBeVisible();
    const linkedAliceNode = window.locator('.json-node', { hasText: 'Linked Alice' }).first();
    await expect(linkedAliceNode).toBeVisible();
});

test('enum translations and timestamp conversion', async () => {
    await window.getByRole('button', { name: 'Hierarchical' }).click();
    await window.locator('[id="json-node-root.0"]').click();
    await window.locator('[id="json-node-root.1"]').click();

    // Alice status: 1 -> Active
    await expect(window.locator('[id="json-node-root.0.status"]').locator('.json-translation')).toHaveText('(Active)');
    // Bob status: 0 -> Inactive
    await expect(window.locator('[id="json-node-root.1.status"]').locator('.json-translation')).toHaveText('(Inactive)');

    // Check _ts internal timestamp conversion
    await expect(window.locator('[id="json-node-root.0._ts"]').locator('.json-translation')).toContainText('2023-01-01');
});
