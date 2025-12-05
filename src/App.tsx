import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { QueryEditor } from './components/QueryEditor';
import { ResultsView } from './components/ResultsView';
import { ConnectionForm } from './components/ConnectionForm';
import { cosmos } from './services/cosmos';
import { ThemeProvider } from './context/ThemeContext';
import { QueryTab } from './types';

function App() {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionString, setConnectionString] = useState('');
    const [databases, setDatabases] = useState<string[]>([]);
    const [containers, setContainers] = useState<Record<string, string[]>>({});

    // View State for Sidebar (Expanded DB)
    const [sidebarDatabaseId, setSidebarDatabaseId] = useState<string | null>(null);

    // Tab State
    const [tabs, setTabs] = useState<QueryTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    const [accountName, setAccountName] = useState('Cosmos DB');

    // Derived Selection State for Sidebar Highlighting
    const activeTab = tabs.find(t => t.id === activeTabId);

    // Derived sidebar highlighting
    const highlightedContainer = activeTab?.containerId || null;
    const highlightedDatabase = activeTab?.databaseId || sidebarDatabaseId;

    // Sync sidebar expansion when tab changes
    useEffect(() => {
        if (activeTab?.databaseId) {
            setSidebarDatabaseId(activeTab.databaseId);
        }
    }, [activeTabId, activeTab?.databaseId]);

    const handleConnect = async (connStr: string) => {
        setConnectionString(connStr);
        const result = await cosmos.connect(connStr);
        if (result.success && result.data) {
            setDatabases(result.data.databases);
            setAccountName(result.data.accountName);
            setIsConnected(true);
        }
    };

    const handleSelectDatabase = async (dbId: string | null) => {
        if (dbId === null) {
            setSidebarDatabaseId(null);
            return;
        }

        setSidebarDatabaseId(dbId);
        if (!containers[dbId]) {
            const result = await cosmos.getContainers(dbId);
            if (result.success && result.data) {
                setContainers(prev => ({ ...prev, [dbId]: result.data! }));
            }
        }
    };

    const handleSelectContainer = (containerId: string | null) => {
        // We assume the container belongs to the currently expanded sidebarDatabaseId
        if (!containerId || !sidebarDatabaseId) return;

        const newTabId = `${sidebarDatabaseId}/${containerId}`;
        const existingTab = tabs.find(t => t.id === newTabId);

        if (existingTab) {
            setActiveTabId(newTabId);
        } else {
            const newTab: QueryTab = {
                id: newTabId,
                databaseId: sidebarDatabaseId,
                containerId: containerId,
                query: 'SELECT * FROM c',
                results: [],
                isQuerying: false,
                pageSize: 10
            };
            setTabs(prev => [...prev, newTab]);
            setActiveTabId(newTabId);
        }
    };

    const handleTabClose = (tabId: string) => {
        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== tabId);
            // If we closed the active tab, switch to the last one or null
            if (tabId === activeTabId) {
                const lastTab = newTabs[newTabs.length - 1];
                setActiveTabId(lastTab ? lastTab.id : null);
            }
            return newTabs;
        });
    };

    const handleQueryChange = (query: string) => {
        setTabs(prev => prev.map(t =>
            t.id === activeTabId ? { ...t, query } : t
        ));
    };

    const handlePageSizeChange = (pageSize: number | 'All') => {
        setTabs(prev => prev.map(t =>
            t.id === activeTabId ? { ...t, pageSize } : t
        ));
    };

    const handleRunQuery = async (query: string, pageSize: number | 'All') => {
        if (!activeTab || !activeTabId) return;

        // Set isQuerying
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isQuerying: true } : t));

        const result = await cosmos.query(activeTab.databaseId, activeTab.containerId, query, pageSize);

        setTabs(prev => prev.map(t => {
            if (t.id !== activeTabId) return t;
            return {
                ...t,
                isQuerying: false,
                results: (result.success && result.data) ? result.data : [],
                error: result.success ? undefined : result.error
            };
        }));
    };

    const handleGetDocument = async (docId: string) => {
        if (!activeTab || !activeTabId) return;

        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isQuerying: true } : t));

        const result = await cosmos.getDocument(activeTab.databaseId, activeTab.containerId, docId);

        setTabs(prev => prev.map(t => {
            if (t.id !== activeTabId) return t;
            return {
                ...t,
                isQuerying: false,
                results: (result.success && result.data) ? [result.data] : [],
                error: result.success ? undefined : result.error
            };
        }));
    };

    if (!isConnected) {
        return (
            <ThemeProvider>
                <ConnectionForm onConnect={handleConnect} />
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider>
            <Layout
                sidebar={
                    <Sidebar
                        databases={databases}
                        selectedDatabase={highlightedDatabase}
                        selectedContainer={highlightedContainer}
                        onSelectDatabase={handleSelectDatabase}
                        onSelectContainer={handleSelectContainer}
                        containers={containers}
                        accountName={accountName}
                    />
                }
                content={
                    <>
                        <QueryEditor
                            tabs={tabs}
                            activeTabId={activeTabId}
                            onTabSelect={setActiveTabId}
                            onTabClose={handleTabClose}
                            onRunQuery={handleRunQuery}
                            onGetDocument={handleGetDocument}
                            onQueryChange={handleQueryChange}
                            onPageSizeChange={handlePageSizeChange}
                        />
                        <ResultsView
                            results={activeTab?.results || []}
                            loading={activeTab?.isQuerying || false}
                        />
                    </>
                }
            />
        </ThemeProvider>
    );
}

export default App;
