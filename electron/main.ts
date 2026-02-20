import { app, BrowserWindow, dialog, ipcMain, Menu, MenuItemConstructorOptions, safeStorage, shell, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { cosmosService } from './cosmos';

process.env.DIST = path.join(__dirname, '../dist');

// Helper function to get VITE_PUBLIC path - defer app.isPackaged access
function getVitePublicPath(): string {
    return app.isPackaged ? process.env.DIST! : path.join(process.env.DIST!, '../public');
}

const isDev = !!process.env['VITE_DEV_SERVER_URL'];


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
        icon: path.join(getVitePublicPath(), isDev ? 'v_dev.png' : 'icon.icns'),
        title: isDev ? 'Dev - Kosumoso' : 'Kosumoso',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    if (isDev) {
        win.on('page-title-updated', (event, title) => {
            if (!title.startsWith('Dev - ')) {
                event.preventDefault();
                win?.setTitle(`Dev - ${title}`);
            }
        });
    }

    // Restore maximized state if applicable
    if (savedState?.isMaximized) {
        win.maximize();
    }

    // Track window state changes
    trackWindowState(win, 'main');

    // Intercept Cmd+W/Cmd+S to handle them in renderer instead of default browser behavior
    win.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && (input.meta || input.control) && !input.shift && !input.alt) {
            if (input.key === 'w') {
                event.preventDefault();
                win?.webContents.send('close-active-tab');
            } else if (input.key.toLowerCase() === 's' || input.code === 'KeyS') {
                event.preventDefault();
                win?.webContents.send('menu:save');
            }
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

ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});

ipcMain.handle('app:openExternal', async (_, url: string) => {
    if (!url || typeof url !== 'string') {
        return { success: false, error: 'Invalid URL' };
    }
    try {
        await shell.openExternal(url);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('app:checkUpdate', async () => {
    return new Promise((resolve) => {
        const url = 'https://api.github.com/repos/LosManos/Ushi-Suki-KoSumoso/releases/latest';
        const request = net.request(url);

        request.on('response', (response: any) => {
            let body = '';
            response.on('data', (chunk: Buffer) => {
                body += chunk.toString();
            });
            response.on('end', () => {
                try {
                    if (response.statusCode === 200) {
                        const release = JSON.parse(body);
                        const latestVersion = release.tag_name.replace(/^v/, '');
                        const currentVersion = app.getVersion();

                        // Simple version comparison (semantic)
                        const latest = latestVersion.split('.').map(Number);
                        const current = currentVersion.split('.').map(Number);

                        let isNewer = false;
                        for (let i = 0; i < 3; i++) {
                            if ((latest[i] || 0) > (current[i] || 0)) {
                                isNewer = true;
                                break;
                            }
                            if ((latest[i] || 0) < (current[i] || 0)) {
                                break;
                            }
                        }

                        resolve({
                            isNewer,
                            latestVersion,
                            currentVersion,
                            url: release.html_url,
                            publishedAt: release.published_at
                        });
                    } else {
                        resolve({ error: `GitHub API returned ${response.statusCode}` });
                    }
                } catch (e: any) {
                    resolve({ error: e.message });
                }
            });
        });

        request.on('error', (error: Error) => {
            resolve({ error: error.message });
        });

        request.end();
    });
});

ipcMain.handle('app:getReleases', async () => {
    return new Promise((resolve) => {
        const url = 'https://api.github.com/repos/LosManos/Ushi-Suki-KoSumoso/releases';
        const request = net.request({
            url,
            headers: { 'User-Agent': 'Kosumoso-App' } // GitHub requires user agent
        });

        request.on('response', (response: any) => {
            let body = '';
            response.on('data', (chunk: Buffer) => {
                body += chunk.toString();
            });
            response.on('end', () => {
                try {
                    if (response.statusCode === 200) {
                        const releases = JSON.parse(body);
                        resolve(releases.map((r: any) => ({
                            version: r.tag_name.replace(/^v/, ''),
                            date: r.published_at.split('T')[0],
                            body: r.body,
                            url: r.html_url
                        })));
                    } else {
                        resolve({ error: `GitHub API returned ${response.statusCode}` });
                    }
                } catch (e: any) {
                    resolve({ error: e.message });
                }
            });
        });

        request.on('error', (error: Error) => {
            resolve({ error: error.message });
        });

        request.end();
    });
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
            icon: path.join(getVitePublicPath(), isDev ? 'v_dev.png' : 'icon.icns'),
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
            },
            title: isDev ? 'Dev - Compare Documents' : 'Compare Documents',
        });

        if (isDev) {
            compareWin.on('page-title-updated', (event, title) => {
                if (!title.startsWith('Dev - ')) {
                    event.preventDefault();
                    compareWin.setTitle(`Dev - ${title}`);
                }
            });
        }

        // Restore maximized state if applicable
        if (savedState?.isMaximized) {
            compareWin.maximize();
        }

        // Track window state changes
        trackWindowState(compareWin, 'compare');


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
    return docs || [];
});

app.setName('Kosumoso');

app.whenReady().then(() => {
    const connectionsPath = path.join(app.getPath('userData'), 'connections.json');
    const historyPath = path.join(app.getPath('userData'), 'history.json');
    const templatesPath = path.join(app.getPath('userData'), 'templates.json');
    const schemasPath = path.join(app.getPath('userData'), 'schemas.json');
    const linksPath = path.join(app.getPath('userData'), 'links.json');
    const translationsPath = path.join(app.getPath('userData'), 'translations.json');

    createWindow();

    // Create application menu
    const isMac = process.platform === 'darwin';
    const template: MenuItemConstructorOptions[] = [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                {
                    label: `About ${app.name}`,
                    click: () => {
                        dialog.showMessageBox({
                            title: `About ${app.name}`,
                            message: app.name,
                            detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode: ${process.versions.node}`,
                            buttons: ['OK'],
                            icon: path.join(getVitePublicPath(), isDev ? 'v_dev.png' : 'icon.icns'),
                        });
                    }
                },
                {
                    label: "What's New",
                    click: () => win?.webContents.send('menu:show-changelog')
                },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] as MenuItemConstructorOptions[] : []),
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Query Tab',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => win?.webContents.send('menu:new-tab')
                },
                { type: 'separator' },
                {
                    label: 'Close Tab',
                    accelerator: 'CmdOrCtrl+W',
                    click: () => win?.webContents.send('close-active-tab')
                },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => win?.webContents.send('menu:save')
                },
                { type: 'separator' },
                isMac ? { role: 'close' } : { role: 'quit' }
            ] as MenuItemConstructorOptions[]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ] as MenuItemConstructorOptions[]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ] as MenuItemConstructorOptions[]
        },
        {
            label: 'Storage',
            submenu: [
                {
                    label: 'View History File...',
                    click: async () => {
                        if (!fs.existsSync(historyPath)) await fs.promises.writeFile(historyPath, '[]');
                        shell.showItemInFolder(historyPath);
                    }
                },
                {
                    label: 'View Connections File...',
                    click: async () => {
                        if (!fs.existsSync(connectionsPath)) await fs.promises.writeFile(connectionsPath, '[]');
                        shell.showItemInFolder(connectionsPath);
                    }
                },
                {
                    label: 'View Link Mappings File...',
                    click: async () => {
                        if (!fs.existsSync(linksPath)) await fs.promises.writeFile(linksPath, JSON.stringify({ Accounts: [] }, null, 2));
                        shell.showItemInFolder(linksPath);
                    }
                },
                {
                    label: 'View Translations File...',
                    click: async () => {
                        if (!fs.existsSync(translationsPath)) await fs.promises.writeFile(translationsPath, JSON.stringify({ Accounts: [] }, null, 2));
                        shell.showItemInFolder(translationsPath);
                    }
                },
                { type: 'separator' },
                {
                    label: 'View Templates File...',
                    click: async () => {
                        if (!fs.existsSync(templatesPath)) await fs.promises.writeFile(templatesPath, JSON.stringify({ Accounts: [] }, null, 2));
                        shell.showItemInFolder(templatesPath);
                    }
                },
                {
                    label: 'View Schemas File...',
                    click: async () => {
                        if (!fs.existsSync(schemasPath)) await fs.promises.writeFile(schemasPath, JSON.stringify({ Accounts: [] }, null, 2));
                        shell.showItemInFolder(schemasPath);
                    }
                }
            ] as MenuItemConstructorOptions[]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ] : [
                    { role: 'close' }
                ])
            ] as MenuItemConstructorOptions[]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        await shell.openExternal('https://github.com/LosManos/Ushi-Suki-KoSumoso');
                    }
                },
                {
                    label: "What's New",
                    click: () => win?.webContents.send('menu:show-changelog')
                },
                { type: 'separator' },
                {
                    label: `About ${app.name}`,
                    click: () => {
                        dialog.showMessageBox({
                            title: `About ${app.name}`,
                            message: app.name,
                            detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode: ${process.versions.node}`,
                            buttons: ['OK'],
                            icon: path.join(getVitePublicPath(), isDev ? 'v_dev.png' : 'icon.icns'),
                        });
                    }
                }

            ] as MenuItemConstructorOptions[]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Set dock icon on macOS
    if (process.platform === 'darwin' && app.dock) {
        const iconPath = path.join(getVitePublicPath(), isDev ? 'v_dev.png' : 'v_macos.png');
        app.dock.setIcon(iconPath);
    }



    // Schema storage handlers
    ipcMain.handle('storage:saveSchema', async (_, storageKey: string, keys: string[]) => {
        try {
            let data: any = { Accounts: [] };
            try {
                if (fs.existsSync(schemasPath)) {
                    const content = await fs.promises.readFile(schemasPath, 'utf8');
                    data = JSON.parse(content);
                }
            } catch (e) { }

            if (!data.Accounts) data = { Accounts: [] };

            const [accountName, databaseId, containerId] = storageKey.split('/');

            let accountObj = data.Accounts.find((a: any) => a.Name === accountName);
            if (!accountObj) {
                accountObj = { Name: accountName, Databases: [] };
                data.Accounts.push(accountObj);
            }

            let databaseObj = accountObj.Databases.find((d: any) => d.Name === databaseId);
            if (!databaseObj) {
                databaseObj = { Name: databaseId, Containers: [] };
                accountObj.Databases.push(databaseObj);
            }

            let containerObj = databaseObj.Containers.find((c: any) => c.Name === containerId);
            if (!containerObj) {
                containerObj = { Name: containerId, Keys: [], LastUpdated: '' };
                databaseObj.Containers.push(containerObj);
            }

            containerObj.Keys = keys;
            containerObj.LastUpdated = new Date().toISOString();

            await fs.promises.writeFile(schemasPath, JSON.stringify(data, null, 2));
            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to save schema:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:getSchemas', async () => {
        try {
            if (!fs.existsSync(schemasPath)) return { success: true, data: {} };

            const content = await fs.promises.readFile(schemasPath, 'utf8');
            const data = JSON.parse(content);

            // Reconstruct flat map for renderer
            const flatSchemas: Record<string, string[]> = {};
            if (data && data.Accounts) {
                for (const account of data.Accounts) {
                    for (const db of account.Databases) {
                        for (const cont of db.Containers) {
                            const storageKey = `${account.Name}/${db.Name}/${cont.Name}`;
                            flatSchemas[storageKey] = cont.Keys || [];
                        }
                    }
                }
            }
            return { success: true, data: flatSchemas };
        } catch (error: any) {
            console.error('[Main] Failed to get schemas:', error);
            return { success: false, error: error.message };
        }
    });

    // Template storage handlers
    ipcMain.handle('storage:saveTemplate', async (_, storageKey: string, template: string) => {
        try {
            let data: any = { Accounts: [] };
            try {
                if (fs.existsSync(templatesPath)) {
                    const content = await fs.promises.readFile(templatesPath, 'utf8');
                    data = JSON.parse(content);
                }
            } catch (e) { }

            if (!data.Accounts) data = { Accounts: [] };

            const [accountName, databaseId, containerId] = storageKey.split('/');

            let accountObj = data.Accounts.find((a: any) => a.Name === accountName);
            if (!accountObj) {
                accountObj = { Name: accountName, Databases: [] };
                data.Accounts.push(accountObj);
            }

            let databaseObj = accountObj.Databases.find((d: any) => d.Name === databaseId);
            if (!databaseObj) {
                databaseObj = { Name: databaseId, Containers: [] };
                accountObj.Databases.push(databaseObj);
            }

            let containerObj = databaseObj.Containers.find((c: any) => c.Name === containerId);

            if (template.trim()) {
                if (!containerObj) {
                    containerObj = { Name: containerId, Template: '', LastUpdated: '' };
                    databaseObj.Containers.push(containerObj);
                }
                containerObj.Template = template;
                containerObj.LastUpdated = new Date().toISOString();
            } else if (containerObj) {
                // Remove container if template is empty
                databaseObj.Containers = databaseObj.Containers.filter((c: any) => c.Name !== containerId);

                // Cleanup empty objects up the tree
                if (databaseObj.Containers.length === 0) {
                    accountObj.Databases = accountObj.Databases.filter((d: any) => d.Name !== databaseId);
                }
                if (accountObj.Databases.length === 0) {
                    data.Accounts = data.Accounts.filter((a: any) => a.Name !== accountName);
                }
            }

            await fs.promises.writeFile(templatesPath, JSON.stringify(data, null, 2));
            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to save template:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:getTemplates', async () => {
        try {
            if (!fs.existsSync(templatesPath)) return { success: true, data: {} };

            const content = await fs.promises.readFile(templatesPath, 'utf8');
            const data = JSON.parse(content);

            // Reconstruct flat map for renderer
            const flatTemplates: Record<string, string> = {};
            if (data && data.Accounts) {
                for (const account of data.Accounts) {
                    for (const db of account.Databases) {
                        for (const cont of db.Containers) {
                            const storageKey = `${account.Name}/${db.Name}/${cont.Name}`;
                            flatTemplates[storageKey] = cont.Template || '';
                        }
                    }
                }
            }
            return { success: true, data: flatTemplates };
        } catch (error: any) {
            console.error('[Main] Failed to get templates:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:deleteTemplate', async (_, storageKey: string) => {
        try {
            if (!fs.existsSync(templatesPath)) return { success: true };

            const content = await fs.promises.readFile(templatesPath, 'utf8');
            const data = JSON.parse(content);

            if (!data.Accounts) return { success: true };

            const [accountName, databaseId, containerId] = storageKey.split('/');

            const accountObj = data.Accounts.find((a: any) => a.Name === accountName);
            if (accountObj) {
                const databaseObj = accountObj.Databases.find((d: any) => d.Name === databaseId);
                if (databaseObj) {
                    databaseObj.Containers = databaseObj.Containers.filter((c: any) => c.Name !== containerId);

                    // Cleanup
                    if (databaseObj.Containers.length === 0) {
                        accountObj.Databases = accountObj.Databases.filter((d: any) => d.Name !== databaseId);
                    }
                    if (accountObj.Databases.length === 0) {
                        data.Accounts = data.Accounts.filter((a: any) => a.Name !== accountName);
                    }
                }
            }

            await fs.promises.writeFile(templatesPath, JSON.stringify(data, null, 2));
            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to delete template:', error);
            return { success: false, error: error.message };
        }
    });

    // Link storage handlers
    ipcMain.handle('storage:saveLink', async (_, sourceKey: string, mapping: any) => {
        try {
            let data: any = { Accounts: [] };
            try {
                if (fs.existsSync(linksPath)) {
                    const content = await fs.promises.readFile(linksPath, 'utf8');
                    data = JSON.parse(content);
                }
            } catch (e) { }

            if (!data.Accounts) data = { Accounts: [] };

            // sourceKey is "accountName/dbId/containerId:propertyPath"
            const [accountDbContainer, propertyPath] = sourceKey.split(':');
            const parts = accountDbContainer.split('/');
            if (parts.length < 3) throw new Error('Invalid sourceKey');

            const accountName = parts[0];
            const databaseId = parts[1];
            const containerId = parts.slice(2).join('/');

            let account = data.Accounts.find((a: any) => a.Name === accountName);
            if (!account) {
                account = { Name: accountName, Databases: [] };
                data.Accounts.push(account);
            }

            let database = account.Databases.find((d: any) => d.Name === databaseId);
            if (!database) {
                database = { Name: databaseId, Containers: [] };
                account.Databases.push(database);
            }

            let container = database.Containers.find((c: any) => c.Name === containerId);
            if (!container) {
                container = { Name: containerId, Links: [] };
                database.Containers.push(container);
            }

            // Update or add link
            const newLink = {
                PropertyPath: propertyPath,
                TargetDb: mapping.targetDb,
                TargetContainer: mapping.targetContainer,
                TargetPropertyName: mapping.targetPropertyName,
                LastUpdated: new Date().toISOString()
            };

            if (!container.Links) container.Links = [];
            const existingIndex = container.Links.findIndex((l: any) => l.PropertyPath === propertyPath);
            if (existingIndex >= 0) {
                container.Links[existingIndex] = newLink;
            } else {
                container.Links.push(newLink);
            }

            await fs.promises.writeFile(linksPath, JSON.stringify(data, null, 2));
            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to save link mapping:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:getLinks', async () => {
        try {
            if (!fs.existsSync(linksPath)) return { success: true, data: {} };

            const content = await fs.promises.readFile(linksPath, 'utf8');
            const data = JSON.parse(content);

            // Reconstruct flat map for renderer
            const flatLinks: Record<string, any> = {};
            if (data && data.Accounts) {
                for (const account of data.Accounts) {
                    for (const db of account.Databases) {
                        for (const cont of db.Containers) {
                            if (cont.Links) {
                                for (const link of cont.Links) {
                                    const sourceKey = `${account.Name}/${db.Name}/${cont.Name}:${link.PropertyPath}`;
                                    flatLinks[sourceKey] = {
                                        targetDb: link.TargetDb,
                                        targetContainer: link.TargetContainer,
                                        targetPropertyName: link.TargetPropertyName,
                                        lastUpdated: link.LastUpdated
                                    };
                                }
                            }
                        }
                    }
                }
            }
            return { success: true, data: flatLinks };
        } catch (error: any) {
            console.error('[Main] Failed to get links:', error);
            return { success: false, error: error.message };
        }
    });

    // Translation storage handlers
    ipcMain.handle('storage:saveTranslation', async (_, account: string, containerPath: string, propertyPath: string, value: any, translation: string) => {
        try {
            let data: any = { Accounts: [] };
            try {
                if (fs.existsSync(translationsPath)) {
                    const content = await fs.promises.readFile(translationsPath, 'utf8');
                    data = JSON.parse(content);
                }
            } catch (e) { }

            if (!data.Accounts) data = { Accounts: [] };

            const [dbId, containerId] = containerPath.split('/');

            let accountObj = data.Accounts.find((a: any) => a.Name === account);
            if (!accountObj) {
                accountObj = { Name: account, Databases: [] };
                data.Accounts.push(accountObj);
            }

            let databaseObj = accountObj.Databases.find((d: any) => d.Name === dbId);
            if (!databaseObj) {
                databaseObj = { Name: dbId, Containers: [] };
                accountObj.Databases.push(databaseObj);
            }

            let containerObj = databaseObj.Containers.find((c: any) => c.Name === containerId);
            if (!containerObj) {
                containerObj = { Name: containerId, Properties: [] };
                databaseObj.Containers.push(containerObj);
            }

            let propertyObj = containerObj.Properties.find((p: any) => p.Path === propertyPath);
            if (!propertyObj) {
                propertyObj = { Path: propertyPath, Mappings: [] };
                containerObj.Properties.push(propertyObj);
            }

            const valueStr = String(value);
            if (translation && translation.trim()) {
                const newMapping = {
                    Value: valueStr,
                    Translation: translation,
                    LastUpdated: new Date().toISOString()
                };
                const existingIndex = propertyObj.Mappings.findIndex((m: any) => m.Value === valueStr);
                if (existingIndex >= 0) {
                    propertyObj.Mappings[existingIndex] = newMapping;
                } else {
                    propertyObj.Mappings.push(newMapping);
                }
            } else {
                propertyObj.Mappings = propertyObj.Mappings.filter((m: any) => m.Value !== valueStr);

                // Cleanup empty objects up the tree
                if (propertyObj.Mappings.length === 0) {
                    containerObj.Properties = containerObj.Properties.filter((p: any) => p.Path !== propertyPath);
                }
                if (containerObj.Properties.length === 0) {
                    databaseObj.Containers = databaseObj.Containers.filter((c: any) => c.Name !== containerId);
                }
                if (databaseObj.Containers.length === 0) {
                    accountObj.Databases = accountObj.Databases.filter((d: any) => d.Name !== dbId);
                }
                if (accountObj.Databases.length === 0) {
                    data.Accounts = data.Accounts.filter((a: any) => a.Name !== account);
                }
            }

            await fs.promises.writeFile(translationsPath, JSON.stringify(data, null, 2));
            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to save translation:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:getTranslations', async () => {
        try {
            if (!fs.existsSync(translationsPath)) return { success: true, data: {} };

            const content = await fs.promises.readFile(translationsPath, 'utf8');
            const data = JSON.parse(content);

            // Reconstruct nested object format for renderer
            const result: any = {};
            if (data && data.Accounts) {
                for (const account of data.Accounts) {
                    result[account.Name] = {};
                    for (const db of account.Databases) {
                        result[account.Name][db.Name] = {};
                        for (const cont of db.Containers) {
                            result[account.Name][db.Name][cont.Name] = {};
                            for (const prop of cont.Properties) {
                                result[account.Name][db.Name][cont.Name][prop.Path] = {};
                                for (const mapping of prop.Mappings) {
                                    result[account.Name][db.Name][cont.Name][prop.Path][mapping.Value] = mapping.Translation;
                                }
                            }
                        }
                    }
                }
            }
            return { success: true, data: result };
        } catch (error: any) {
            console.error('[Main] Failed to get translations:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:showTranslationsFile', async () => {
        try {
            if (!fs.existsSync(translationsPath)) {
                await fs.promises.writeFile(translationsPath, JSON.stringify({ Accounts: [] }, null, 2));
            }
            shell.showItemInFolder(translationsPath);
            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to show translations file:', error);
            return { success: false, error: error.message };
        }
    });
    // IPC handlers to show files in Finder
    ipcMain.handle('storage:showHistoryFile', async () => {
        try {
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

    ipcMain.handle('storage:showLinksFile', async () => {
        try {
            if (!fs.existsSync(linksPath)) {
                await fs.promises.writeFile(linksPath, JSON.stringify({ Accounts: [] }, null, 2));
            }
            shell.showItemInFolder(linksPath);
            return { success: true };
        } catch (error: any) {
            console.error('[Main] Failed to show links file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:saveConnection', async (_, name: string, connectionString: string) => {
        try {
            if (!safeStorage.isEncryptionAvailable()) {
                console.error('[Main] Encryption not available');
                throw new Error('Encryption is not available');
            }

            let connections: any[] = [];
            try {
                const data = await fs.promises.readFile(connectionsPath, 'utf8');
                connections = JSON.parse(data);
            } catch (error) {
                // File might not exist yet, ignore
            }

            const encrypted = safeStorage.encryptString(connectionString).toString('base64');

            // Remove existing with same name if any
            connections = connections.filter(c => c.name !== name);

            // Add new or updated
            connections.unshift({
                name,
                encryptedConnectionString: encrypted,
                lastUsed: Date.now()
            });

            await fs.promises.writeFile(connectionsPath, JSON.stringify(connections, null, 2));

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

    function migrateToExplicitHierarchy(data: any): any {
        if (!data || (data.Accounts && Array.isArray(data.Accounts))) {
            return data || { Accounts: [] };
        }

        const hierarchical: any = { Accounts: [] };

        if (Array.isArray(data)) {
            data.forEach((h: any) => {
                const accName = h.accountName || 'Default Account';
                const dbId = h.databaseId || 'Default DB';
                const contId = h.containerId || 'Default Container';

                let account = hierarchical.Accounts.find((a: any) => a.Name === accName);
                if (!account) {
                    account = { Name: accName, Databases: [] };
                    hierarchical.Accounts.push(account);
                }

                let database = account.Databases.find((d: any) => d.Name === dbId);
                if (!database) {
                    database = { Name: dbId, Containers: [] };
                    account.Databases.push(database);
                }

                let container = database.Containers.find((c: any) => c.Name === contId);
                if (!container) {
                    container = { Name: contId, Items: [] };
                    database.Containers.push(container);
                }

                const itemQuery = h.query || h.Query;
                if (!container.Items.find((i: any) => i.Query === itemQuery)) {
                    container.Items.push({
                        Id: h.id || h.Id || Math.random().toString(36).substring(2, 15),
                        Query: itemQuery,
                        Timestamp: h.timestamp || h.Timestamp || Date.now()
                    });
                }
            });
        }

        return hierarchical;
    }

    ipcMain.handle('storage:saveHistory', async (_, item: any) => {
        try {
            let currentData: any = { Accounts: [] };
            try {
                if (fs.existsSync(historyPath)) {
                    const content = await fs.promises.readFile(historyPath, 'utf8');
                    currentData = JSON.parse(content);
                }
            } catch (e) { }

            const history = migrateToExplicitHierarchy(currentData);
            const { accountName, databaseId, containerId, query, timestamp, id } = item;

            let account = history.Accounts.find((a: any) => a.Name === accountName);
            if (!account) {
                account = { Name: accountName, Databases: [] };
                history.Accounts.push(account);
            }

            let database = account.Databases.find((d: any) => d.Name === databaseId);
            if (!database) {
                database = { Name: databaseId, Containers: [] };
                account.Databases.push(database);
            }

            let container = database.Containers.find((c: any) => c.Name === containerId);
            if (!container) {
                container = { Name: containerId, Items: [] };
                database.Containers.push(container);
            }

            // Deduplicate in this container
            container.Items = container.Items.filter((i: any) => i.Query !== query);

            // Add to top with requested keys
            container.Items.unshift({
                Id: id || Math.random().toString(36).substring(2, 15),
                Query: query,
                Timestamp: timestamp || Date.now()
            });

            // Limit per container
            if (container.Items.length > 100) {
                container.Items = container.Items.slice(0, 100);
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
            if (!fs.existsSync(historyPath)) return { success: true, data: [] };

            const content = await fs.promises.readFile(historyPath, 'utf8');
            const rawData = JSON.parse(content);
            const history = migrateToExplicitHierarchy(rawData);

            // Force save the migrated version so the user sees the change in the file immediately
            await fs.promises.writeFile(historyPath, JSON.stringify(history, null, 2));

            // Flat list for renderer
            const flatList: any[] = [];
            for (const account of history.Accounts) {
                for (const db of account.Databases) {
                    for (const cont of db.Containers) {
                        for (const item of cont.Items) {
                            flatList.push({
                                id: item.Id,
                                accountName: account.Name,
                                databaseId: db.Name,
                                containerId: cont.Name,
                                query: item.Query,
                                timestamp: item.Timestamp
                            });
                        }
                    }
                }
            }

            flatList.sort((a, b) => b.timestamp - a.timestamp);
            return { success: true, data: flatList };
        } catch (error: any) {
            console.error('[Main] Failed to get history:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:deleteHistory', async (_, item: any) => {
        try {
            if (!fs.existsSync(historyPath)) return { success: true };

            const content = await fs.promises.readFile(historyPath, 'utf8');
            const data = JSON.parse(content);
            const history = migrateToExplicitHierarchy(data);

            const { accountName, databaseId, containerId, id } = item;
            const account = history.Accounts.find((a: any) => a.Name === accountName);
            if (account) {
                const database = account.Databases.find((d: any) => d.Name === databaseId);
                if (database) {
                    const container = database.Containers.find((c: any) => c.Name === containerId);
                    if (container) {
                        container.Items = container.Items.filter((i: any) => (i.Id || i.id) !== id);
                        if (container.Items.length === 0) {
                            database.Containers = database.Containers.filter((c: any) => c.Name !== containerId);
                        }
                    }
                    if (database.Containers.length === 0) {
                        account.Databases = account.Databases.filter((d: any) => d.Name !== databaseId);
                    }
                }
                if (account.Databases.length === 0) {
                    history.Accounts = history.Accounts.filter((a: any) => a.Name !== accountName);
                }
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

    ipcMain.handle('cosmos:upsertDocument', async (_, dbId, containerId, document) => {
        return await cosmosService.upsertDocument(dbId, containerId, document);
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
