import React, { useState, useEffect } from 'react';
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

    // Resize State
    const [queryPaneHeight, setQueryPaneHeight] = useState(300);
    const [isDragging, setIsDragging] = useState(false);
    const resizeHandleRef = React.useRef<HTMLDivElement>(null);
    const lastFocusedElementRef = React.useRef<HTMLElement | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        // Calculate new height based on mouse Y position relative to window
        // (This is a simplification; precise calc might need offset of top-nav, but sidebar layout usually starts below)
        // Adjusting for top-left (0,0) coordinate system
        // We enforce min height 100px and max height 80% of window
        const newHeight = Math.max(100, Math.min(e.clientY, window.innerHeight * 0.8));
        setQueryPaneHeight(newHeight);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleHandleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setQueryPaneHeight(prev => Math.max(100, prev - 10));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setQueryPaneHeight(prev => Math.min(window.innerHeight * 0.8, prev + 10));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (lastFocusedElementRef.current) {
                lastFocusedElementRef.current.focus();
            } else {
                resizeHandleRef.current?.blur();
            }
        }
    };

    useEffect(() => {
        const handleWindowKeyDown = (e: KeyboardEvent) => {
            // Handle Ctrl+M (or Cmd+M) to focus resize handle
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                lastFocusedElementRef.current = document.activeElement as HTMLElement;
                resizeHandleRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleWindowKeyDown);
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('keydown', handleWindowKeyDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

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
            // Clear previous session state
            setTabs([]);
            setActiveTabId(null);
            setContainers({});
            setSidebarDatabaseId(null);

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


    const executeActiveQuery = () => {
        if (!activeTab || !activeTabId) return;
        handleRunQuery(activeTab.query, activeTab.pageSize);
    };

    const handleChangeConnection = () => {
        setIsConnected(false);
        // Do NOT clear state here, so we can "Cancel" and go back.
    };

    useEffect(() => {
        const handleWindowKeyDown = (e: KeyboardEvent) => {
            // Handle Ctrl+D (or Cmd+D) to change connection
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                handleChangeConnection();
            }
        };

        window.addEventListener('keydown', handleWindowKeyDown);
        return () => window.removeEventListener('keydown', handleWindowKeyDown);
    }, []);

    if (!isConnected) {
        return (
            <ThemeProvider>
                <ConnectionForm
                    onConnect={handleConnect}
                    onCancel={databases.length > 0 ? () => setIsConnected(true) : undefined}
                />
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
                        onChangeConnection={handleChangeConnection}
                    />
                }
                content={
                    <>
                        <div style={{ height: queryPaneHeight, display: 'flex', flexDirection: 'column' }}>
                            <QueryEditor
                                tabs={tabs}
                                activeTabId={activeTabId}
                                onTabSelect={setActiveTabId}
                                onTabClose={handleTabClose}
                                onRunQuery={executeActiveQuery}
                                onGetDocument={handleGetDocument}
                                onQueryChange={handleQueryChange}
                            />
                        </div>

                        <div
                            ref={resizeHandleRef}
                            className={`resize-handle ${isDragging ? 'dragging' : ''}`}
                            onMouseDown={handleMouseDown}
                            tabIndex={0}
                            title="Resize Pane (Ctrl+M)"
                            onKeyDown={handleHandleKeyDown}
                        >
                            <div className="resize-handle-grabber" />
                        </div>

                        <ResultsView
                            results={activeTab?.results || []}
                            loading={activeTab?.isQuerying || false}
                            onRunQuery={executeActiveQuery}
                            pageSize={activeTab?.pageSize || 10}
                            onPageSizeChange={handlePageSizeChange}
                        />
                    </>
                }
            />
        </ThemeProvider>
    );
}

export default App;
