import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import { cosmosService } from './cosmos';

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC || '', 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
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

app.whenReady().then(() => {
    createWindow();

    const connectionsPath = path.join(app.getPath('userData'), 'connections.json');
    const historyPath = path.join(app.getPath('userData'), 'history.json');


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

            // Remove existing item with same key (account, db, container, query)
            // We want to update timestamp aka move to top/update
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
                const history = JSON.parse(data);
                return { success: true, data: history };
            } catch (error) {
                return { success: true, data: [] };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });


    ipcMain.handle('cosmos:connect', async (_, connectionString) => {
        return await cosmosService.connect(connectionString);
    });

    ipcMain.handle('cosmos:query', async (_, dbId, containerId, query, pageSize) => {
        return await cosmosService.query(dbId, containerId, query, pageSize);
    });

    ipcMain.handle('cosmos:getDocument', async (_, dbId, containerId, docId) => {
        return await cosmosService.getDocument(dbId, containerId, docId);
    });

    ipcMain.handle('cosmos:getContainers', async (_, dbId) => {
        return await cosmosService.getContainers(dbId);
    });
});
