import fs from 'fs';

// --- Helper Functions ---

export function migrateToExplicitHierarchy(data: any): any {
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

// --- Schema Handlers ---

export async function saveSchema(filePath: string, storageKey: string, keys: string[]): Promise<any> {
    try {
        let data: any = { Accounts: [] };
        try {
            if (fs.existsSync(filePath)) {
                const content = await fs.promises.readFile(filePath, 'utf8');
                data = JSON.parse(content);
            }
        } catch (e) {}

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

        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
        return { success: true };
    } catch (error: any) {
        console.error('[Storage] Failed to save schema:', error);
        return { success: false, error: error.message };
    }
}

export async function getSchemas(filePath: string): Promise<any> {
    try {
        if (!fs.existsSync(filePath)) return { success: true, data: {} };

        const content = await fs.promises.readFile(filePath, 'utf8');
        const data = JSON.parse(content);

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
        return { success: false, error: error.message };
    }
}

// --- Template Handlers ---

export async function saveTemplate(filePath: string, storageKey: string, template: string): Promise<any> {
    try {
        let data: any = { Accounts: [] };
        try {
            if (fs.existsSync(filePath)) {
                const content = await fs.promises.readFile(filePath, 'utf8');
                data = JSON.parse(content);
            }
        } catch (e) {}

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

        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getTemplates(filePath: string): Promise<any> {
    try {
        if (!fs.existsSync(filePath)) return { success: true, data: {} };

        const content = await fs.promises.readFile(filePath, 'utf8');
        const data = JSON.parse(content);

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
        return { success: false, error: error.message };
    }
}

export async function deleteTemplate(filePath: string, storageKey: string): Promise<any> {
    try {
        if (!fs.existsSync(filePath)) return { success: true };

        const content = await fs.promises.readFile(filePath, 'utf8');
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

        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
