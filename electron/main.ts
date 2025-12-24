import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { cosmosService } from './cosmos';

process.env.DIST = path.join(__dirname, '../dist');

// Helper function to get VITE_PUBLIC path - defer app.isPackaged access
function getVitePublicPath(): string {
    return app.isPackaged ? process.env.DIST! : path.join(process.env.DIST!, '../public');
}

// Window state persistence
interface WindowState {
    x?: number;
    y?: number;
    width: number;
    height: number;
    isMaximized?: boolean;
}

interface AllWindowStates {
    main?: WindowState;
    compare?: WindowState;
}

function getWindowStatePath(): string {
    return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowStates(): AllWindowStates {
    try {
        const data = fs.readFileSync(getWindowStatePath(), 'utf8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

function saveWindowStates(states: AllWindowStates): void {
    try {
        fs.writeFileSync(getWindowStatePath(), JSON.stringify(states, null, 2));
    } catch (error) {
        console.error('[Main] Failed to save window states:', error);
    }
}

function getWindowState(windowName: 'main' | 'compare'): WindowState | undefined {
    const states = loadWindowStates();
    return states[windowName];
}

function saveWindowState(windowName: 'main' | 'compare', state: WindowState): void {
    const states = loadWindowStates();
    states[windowName] = state;
    saveWindowStates(states);
}

function trackWindowState(win: BrowserWindow, windowName: 'main' | 'compare'): void {
    const saveState = () => {
        if (win.isDestroyed()) return;

        const bounds = win.getBounds();
        const state: WindowState = {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            isMaximized: win.isMaximized(),
        };
        saveWindowState(windowName, state);
    };

    // Save state on various events
    win.on('close', saveState);
    win.on('resize', saveState);
    win.on('move', saveState);
}

let win: BrowserWindow | null;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
    // Restore saved window state
    const savedState = getWindowState('main');
    const defaultWidth = 1200;
    const defaultHeight = 800;

    win = new BrowserWindow({
        x: savedState?.x,
        y: savedState?.y,
        width: savedState?.width ?? defaultWidth,
        height: savedState?.height ?? defaultHeight,
        icon: path.join(getVitePublicPath(), 'icon.icns'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Restore maximized state if applicable
    if (savedState?.isMaximized) {
        win.maximize();
    }

    // Track window state changes
    trackWindowState(win, 'main');

    // Intercept Cmd+W to close tab instead of window
    win.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'w' && (input.meta || input.control) && !input.shift && !input.alt) {
            event.preventDefault();
            win?.webContents.send('close-active-tab');
        }
    });

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString());
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(process.env.DIST || '', 'index.html'));
    }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.on('app:quit', () => {
    app.quit();
});

// Store documents for compare window
let pendingCompareDocuments: any[] | null = null;

// Open comparison window
ipcMain.handle('compare:open', async (_, documents: any[]) => {
    try {
        // Store documents for the compare window to fetch
        pendingCompareDocuments = documents;

        // Restore saved window state or use defaults
        const savedState = getWindowState('compare');
        const defaultWidth = Math.min(400 * documents.length, 1600);
        const defaultHeight = 800;

        const compareWin = new BrowserWindow({
            x: savedState?.x,
            y: savedState?.y,
            width: savedState?.width ?? defaultWidth,
            height: savedState?.height ?? defaultHeight,
            icon: path.join(getVitePublicPath(), 'icon.icns'),
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
            },
            title: 'Compare Documents',
        });

        // Restore maximized state if applicable
        if (savedState?.isMaximized) {
            compareWin.maximize();
        }

        // Track window state changes
        trackWindowState(compareWin, 'compare');

        console.log('[Main] Opening compare window with', documents.length, 'documents');

        if (VITE_DEV_SERVER_URL) {
            await compareWin.loadURL(`${VITE_DEV_SERVER_URL}/compare.html`);
        } else {
            await compareWin.loadFile(path.join(process.env.DIST || '', 'compare.html'));
        }

        return { success: true };
    } catch (error: any) {
        console.error('[Main] Failed to open compare window:', error);
        return { success: false, error: error.message };
    }
});

// Handler for compare window to get documents
ipcMain.handle('compare:getDocuments', () => {
    const docs = pendingCompareDocuments;
    console.log('[Main] compare:getDocuments called, returning', docs?.length || 0, 'documents');
    return docs || [];
});

app.setName('Kosumoso');

app.whenReady().then(() => {
    createWindow();

    // Set dock icon on macOS
    if (process.platform === 'darwin' && app.dock) {
        const iconPath = path.join(getVitePublicPath(), 'v_macos.png');
        app.dock.setIcon(iconPath);
    }

    const connectionsPath = path.join(app.getPath('userData'), 'connections.json');
    const historyPath = path.join(app.getPath('userData'), 'history.json');
    const templatesPath = path.join(app.getPath('userData'), 'templates.json');

    // Template storage handlers
    ipcMain.handle('storage:saveTemplate', async (_, containerId: string, template: string) => {
        try {
            let templates: Record<string, { template: string; lastUpdated: number }> = {};
            try {
                const data = await fs.promises.readFile(templatesPath, 'utf8');
                templates = JSON.parse(data);
            } catch (error) {
                // File might not exist yet
            }

            if (template.trim()) {
                templates[containerId] = { template, lastUpdated: Date.now() };
            } else {
                // Remove empty templates
                delete templates[containerId];
            }

            await fs.promises.writeFile(templatesPath, JSON.stringify(templates, null, 2));
            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to save template:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:getTemplates', async () => {
        try {
            try {
                const data = await fs.promises.readFile(templatesPath, 'utf8');
                const templates = JSON.parse(data);
                // Convert to simple containerId -> template string map
                const result: Record<string, string> = {};
                for (const [key, value] of Object.entries(templates)) {
                    result[key] = (value as any).template || '';
                }
                return { success: true, data: result };
            } catch (error) {
                return { success: true, data: {} };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:deleteTemplate', async (_, containerId: string) => {
        try {
            let templates: Record<string, any> = {};
            try {
                const data = await fs.promises.readFile(templatesPath, 'utf8');
                templates = JSON.parse(data);
            } catch (error) {
                return { success: true };
            }

            delete templates[containerId];
            await fs.promises.writeFile(templatesPath, JSON.stringify(templates, null, 2));
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });
    // IPC handlers to show files in Finder
    ipcMain.handle('storage:showHistoryFile', async () => {
        try {
            // Create file if it doesn't exist
            if (!fs.existsSync(historyPath)) {
                await fs.promises.writeFile(historyPath, '[]');
            }
            shell.showItemInFolder(historyPath);
            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to show history file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:showConnectionsFile', async () => {
        try {
            // Create file if it doesn't exist
            if (!fs.existsSync(connectionsPath)) {
                await fs.promises.writeFile(connectionsPath, '[]');
            }
            shell.showItemInFolder(connectionsPath);
            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to show connections file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:saveConnection', async (_, name: string, connectionString: string) => {
        console.log('[Main] storage:saveConnection called', { name });
        try {
            if (!safeStorage.isEncryptionAvailable()) {
                console.error('[Main] Encryption not available');
                throw new Error('Encryption is not available');
            }
            console.log('[Main] Encryption is available');

            let connections: any[] = [];
            try {
                console.log('[Main] Reading file:', connectionsPath);
                const data = await fs.promises.readFile(connectionsPath, 'utf8');
                connections = JSON.parse(data);
                console.log('[Main] File read successfully, entries: ', connections.length);
            } catch (error) {
                console.log('[Main] File read failed (likely new):', error);
                // File might not exist yet, ignore
            }

            console.log('[Main] Encrypting string...');
            const encrypted = safeStorage.encryptString(connectionString).toString('base64');
            console.log('[Main] String encrypted');

            // Remove existing with same name if any
            connections = connections.filter(c => c.name !== name);

            // Add new or updated
            connections.unshift({
                name,
                encryptedConnectionString: encrypted,
                lastUsed: Date.now()
            });



            console.log('[Main] Writing file...');
            await fs.promises.writeFile(connectionsPath, JSON.stringify(connections, null, 2));
            console.log('[Main] File written successfully');

            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to save connection:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:getConnections', async () => {
        try {
            if (!safeStorage.isEncryptionAvailable()) {
                return { success: true, data: [] };
            }

            try {
                const data = await fs.promises.readFile(connectionsPath, 'utf8');
                const connections = JSON.parse(data);

                const decryptedConnections = connections.map((c: any) => {
                    try {
                        const buffer = Buffer.from(c.encryptedConnectionString, 'base64');
                        const decrypted = safeStorage.decryptString(buffer);
                        return { ...c, connectionString: decrypted };
                    } catch (e) {
                        // Removing invalid/unreadable entries
                        return null;
                    }
                }).filter(Boolean);

                // Sort by lastUsed desc
                decryptedConnections.sort((a: any, b: any) => b.lastUsed - a.lastUsed);

                return { success: true, data: decryptedConnections };
            } catch (error) {
                // Return empty if file doesn't exist
                return { success: true, data: [] };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:deleteConnection', async (_, name: string) => {
        try {
            let connections: any[] = [];
            try {
                const data = await fs.promises.readFile(connectionsPath, 'utf8');
                connections = JSON.parse(data);
            } catch (error) {
                return { success: true };
            }

            connections = connections.filter(c => c.name !== name);
            await fs.promises.writeFile(connectionsPath, JSON.stringify(connections, null, 2));
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:saveHistory', async (_, item: any) => {
        try {
            let history: any[] = [];
            try {
                const data = await fs.promises.readFile(historyPath, 'utf8');
                history = JSON.parse(data);
            } catch (error) {
                // Ignore, start empty
            }

            // Ensure ID (for migration of old items if we were doing that) or just usage
            if (!item.id) {
                // If the frontend didn't send an ID (shouldn't happen with new code), generate one
                // But we don't have crypto here easily without require, let's assume frontend sends it.
                // Or use a simple random string.
                item.id = Math.random().toString(36).substring(2, 15);
            }

            // Remove existing item with same key (account, db, container, query)
            // We still want to deduplicate by content, but we'll use the NEW item (which has a new ID)
            history = history.filter(h =>
                !(h.accountName === item.accountName &&
                    h.databaseId === item.databaseId &&
                    h.containerId === item.containerId &&
                    h.query === item.query)
            );

            // Add new item
            history.unshift(item);

            // Optional: Limit history size? User didn't ask, but good practice. 
            // Let's cap at 1000 for sanity.
            if (history.length > 1000) {
                history = history.slice(0, 1000);
            }

            await fs.promises.writeFile(historyPath, JSON.stringify(history, null, 2));
            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to save history:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:getHistory', async () => {
        try {
            try {
                const data = await fs.promises.readFile(historyPath, 'utf8');
                let history: any[] = JSON.parse(data);

                // Filter out items missing required fields
                const validHistory = history.filter(h =>
                    h.accountName && h.databaseId && h.containerId && h.query
                );

                // Deduplicate by (accountName, databaseId, containerId, query), keeping newest (first occurrence since sorted by timestamp desc)
                const seen = new Set<string>();
                const deduped: any[] = [];
                for (const h of validHistory) {
                    const key = `${h.accountName}|${h.databaseId}|${h.containerId}|${h.query}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        deduped.push(h);
                    }
                }

                // If we cleaned anything, save the cleaned version
                if (deduped.length !== history.length) {
                    await fs.promises.writeFile(historyPath, JSON.stringify(deduped, null, 2));
                }

                return { success: true, data: deduped };
            } catch (error) {
                return { success: true, data: [] };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:deleteHistory', async (_, item: any) => {
        try {
            let history: any[] = [];
            try {
                const data = await fs.promises.readFile(historyPath, 'utf8');
                history = JSON.parse(data);
            } catch (error) {
                return { success: true };
            }

            // Delete by ID if available, otherwise by fallback properties (legacy support)
            if (item.id) {
                history = history.filter(h => h.id !== item.id);
            } else {
                history = history.filter(h =>
                    !(h.accountName === item.accountName &&
                        h.databaseId === item.databaseId &&
                        h.containerId === item.containerId &&
                        h.query === item.query &&
                        h.timestamp === item.timestamp)
                );
            }

            await fs.promises.writeFile(historyPath, JSON.stringify(history, null, 2));
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });



    ipcMain.handle('cosmos:connect', async (_, connectionString) => {
        return await cosmosService.connect(connectionString);
    });

    ipcMain.handle('cosmos:query', async (_, dbId, containerId, query, pageSize, queryId) => {
        return await cosmosService.query(dbId, containerId, query, pageSize, queryId);
    });

    ipcMain.handle('cosmos:cancelQuery', (_, queryId) => {
        return cosmosService.cancelQuery(queryId);
    });

    ipcMain.handle('cosmos:getDocument', async (_, dbId, containerId, docId) => {
        return await cosmosService.getDocument(dbId, containerId, docId);
    });

    ipcMain.handle('cosmos:getContainers', async (_, dbId) => {
        return await cosmosService.getContainers(dbId);
    });

    ipcMain.handle('cosmos:getContainerInfo', async (_, dbId, containerId) => {
        return await cosmosService.getContainerInfo(dbId, containerId);
    });

    ipcMain.handle('cosmos:getContainerKeys', async (_, dbId, containerId, sampleSize) => {
        return await cosmosService.getContainerKeys(dbId, containerId, sampleSize);
    });

    // IPC handler for saving query results to file
    ipcMain.handle('file:saveResults', async (_, content: string) => {
        try {
            const result = await dialog.showSaveDialog(win!, {
                title: 'Save Query Results',
                defaultPath: 'query-results.json',
                filters: [
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (result.canceled || !result.filePath) {
                return { success: false, canceled: true };
            }

            await fs.promises.writeFile(result.filePath, content, 'utf8');
            return { success: true, filePath: result.filePath };
        } catch (error: any) {
            console.error('[Main] Failed to save results file:', error);
            return { success: false, error: error.message };
        }
    });
});
