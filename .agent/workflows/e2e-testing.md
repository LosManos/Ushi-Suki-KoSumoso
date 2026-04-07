---
description: How to correctly implement E2E tests for KoSumosu
---
# E2E Testing Workflow

When adding or modifying Playwright E2E tests in the `e2e/` directory, you MUST follow these rules:

1. **ALWAYS Mock the Database**: Do NOT attempt to connect to a real Cosmos DB instance. All interactions with `ipcMain` channels starting with `cosmos:` or `storage:` must be mocked.
2. **Use Main Process Mocking**: Use `electronApp.evaluate(({ ipcMain }) => { ... })` to intercept IPC calls.
3. **Clean Up Handlers**: Always call `ipcMain.removeHandler('channel-name')` before `ipcMain.handle('channel-name', ...)` to prevent "already has a handler" crashes in Electron.
4. **Isolate Tests**: Use `test.beforeEach` to launch a fresh Electron instance for every test case.
5. **Verify Mock Data**: Always assert against the specific data you provided in your mock (e.g., if you mock a database named 'MockDB_1', wait for a sidebar item with that exact text).

# Recommended Pattern: Global Mock Reset
The best way to ensure mocks don't conflict is to clear all relevant IPC handlers in `test.beforeEach` before re-registering them for specific tests:

```typescript
test.beforeEach(async () => {
  // ... launch electronApp and get window ...

  // RESET ALL HANDLERS
  await electronApp.evaluate(({ ipcMain }) => {
    ['cosmos:connect', 'cosmos:getContainers', 'storage:getConnections'].forEach(channel => {
        ipcMain.removeHandler(channel);
    });
  });
});

test('can connect with mock', async () => {
  await electronApp.evaluate(({ ipcMain }) => {
    ipcMain.handle('cosmos:connect', async () => ({ 
        success: true, 
        data: { databases: ['E2E_Mock_DB'], accountName: 'MockAccount' } 
    }));
  });
  // ... interaction ...
});
```
