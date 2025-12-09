import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { QueryEditor } from './components/QueryEditor';
import { ResultsView } from './components/ResultsView';
import { ConnectionForm } from './components/ConnectionForm';
import { cosmos } from './services/cosmos';
import { ThemeProvider } from './context/ThemeContext';
import { QueryTab, HistoryItem } from './types';
import { historyService } from './services/history';
import { extractParagraphAtCursor } from './utils';

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
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const cursorPositionRef = React.useRef<number | null>(null);

    useEffect(() => {
        historyService.getHistory().then(res => {
            if (res.success && res.data) {
                setHistory(res.data);
            }
        });
    }, []);

    // Resize State
    const [queryPaneHeight, setQueryPaneHeight] = useState(300);
    const [sidebarWidth, setSidebarWidth] = useState(250);
    const [activeDrag, setActiveDrag] = useState<'query' | 'sidebar' | null>(null);
    const queryResizeHandleRef = React.useRef<HTMLDivElement>(null);
    const sidebarResizeHandleRef = React.useRef<HTMLDivElement>(null);
    const lastFocusedElementRef = React.useRef<HTMLElement | null>(null);

    const handleQueryMouseDown = (e: React.MouseEvent) => {
        setActiveDrag('query');
        e.preventDefault();
    };

    const handleSidebarMouseDown = (e: React.MouseEvent) => {
        setActiveDrag('sidebar');
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!activeDrag) return;

        if (activeDrag === 'query') {
            const newHeight = Math.max(100, Math.min(e.clientY, window.innerHeight * 0.8));
            setQueryPaneHeight(newHeight);
        } else if (activeDrag === 'sidebar') {
            const newWidth = Math.max(150, Math.min(e.clientX, window.innerWidth * 0.5));
            setSidebarWidth(newWidth);
        }
    };

    const handleMouseUp = () => {
        setActiveDrag(null);
    };

    const handleQueryHandleKeyDown = (e: React.KeyboardEvent) => {
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
                queryResizeHandleRef.current?.blur();
            }
        }
    };

    const handleSidebarHandleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setSidebarWidth(prev => Math.max(150, prev - 10));
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setSidebarWidth(prev => Math.min(window.innerWidth * 0.5, prev + 10));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (lastFocusedElementRef.current) {
                lastFocusedElementRef.current.focus();
            } else {
                sidebarResizeHandleRef.current?.blur();
            }
        }
    };

    useEffect(() => {
        const handleWindowKeyDown = (e: KeyboardEvent) => {
            // Handle Ctrl+M (or Cmd+M) to focus query resize handle
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                lastFocusedElementRef.current = document.activeElement as HTMLElement;
                queryResizeHandleRef.current?.focus();
            }
            // Handle Ctrl+Shift+M (or Cmd+Shift+M) to focus sidebar resize handle
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                lastFocusedElementRef.current = document.activeElement as HTMLElement;
                sidebarResizeHandleRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleWindowKeyDown);
        if (activeDrag) {
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
    }, [activeDrag]);

    // Derived Selection State for Sidebar Highlighting
    const activeTab = tabs.find(t => t.id === activeTabId);

    // Derived sidebar highlighting
    const highlightedDatabase = sidebarDatabaseId;
    const highlightedContainer = (activeTab?.databaseId === sidebarDatabaseId) ? activeTab?.containerId : null;

    // Sync sidebar expansion when tab changes
    useEffect(() => {
        if (activeTab?.databaseId) {
            setSidebarDatabaseId(activeTab.databaseId);
        }
        // Reset cursor position when tab changes
        cursorPositionRef.current = null;
    }, [activeTabId, activeTab?.databaseId]);

    // Update Window Title
    useEffect(() => {
        if (activeTab?.containerId) {
            document.title = `Cosmos DB Viewer - ${activeTab.containerId}`;
        } else {
            document.title = 'Cosmos DB Viewer';
        }
    }, [activeTab?.containerId]);

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

    const handleSelectContainer = (dbId: string, containerId: string) => {
        if (!containerId || !dbId) return;

        const newTabId = `${dbId}/${containerId}`;
        const existingTab = tabs.find(t => t.id === newTabId);

        if (existingTab) {
            setActiveTabId(newTabId);
        } else {
            const newTab: QueryTab = {
                id: newTabId,
                databaseId: dbId,
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

        // Add to history
        const historyItem: HistoryItem = {
            id: crypto.randomUUID(),
            accountName,
            databaseId: activeTab.databaseId,
            containerId: activeTab.containerId,
            query,
            timestamp: Date.now()
        };
        historyService.addHistoryItem(historyItem);
        setHistory(prev => {
            const filtered = prev.filter(h =>
                !(h.accountName === historyItem.accountName &&
                    h.databaseId === historyItem.databaseId &&
                    h.containerId === historyItem.containerId &&
                    h.query === historyItem.query)
            );
            return [historyItem, ...filtered];
        });

        setTabs(prev => prev.map(t => {
            if (t.id !== activeTabId) return t;
            return {
                ...t,
                isQuerying: false,
                results: result.success ? (result.data?.items || []) : t.results,
                hasMoreResults: result.success ? (result.data?.hasMoreResults || false) : t.hasMoreResults,
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
                results: result.success ? (result.data ? [result.data] : []) : t.results,
                error: result.success ? undefined : result.error
            };
        }));
    };

    const handleDismissError = () => {
        if (!activeTabId) return;
        setTabs(prev => prev.map(t =>
            t.id === activeTabId ? { ...t, error: undefined } : t
        ));
    };

    const handleSelectHistory = (item: HistoryItem) => {
        const tabId = `${item.databaseId}/${item.containerId}`;

        setTabs(prev => {
            const existingTab = prev.find(t => t.id === tabId);
            if (existingTab) {
                // Append history item's query to existing tab's query
                return prev.map(t =>
                    t.id === tabId ? { ...t, query: t.query ? `${t.query}\n\n${item.query}` : item.query } : t
                );
            } else {
                // Create new tab with the history item's query
                const newTab: QueryTab = {
                    id: tabId,
                    databaseId: item.databaseId,
                    containerId: item.containerId,
                    query: item.query,
                    results: [],
                    isQuerying: false,
                    pageSize: 10
                };
                return [...prev, newTab];
            }
        });

        setActiveTabId(tabId);
        setSidebarDatabaseId(item.databaseId);

        // Ensure container list is loaded for this DB if not already
        if (!containers[item.databaseId]) {
            cosmos.getContainers(item.databaseId).then(result => {
                if (result.success && result.data) {
                    setContainers(prev => ({ ...prev, [item.databaseId]: result.data! }));
                }
            });
        }
    };

    const handleCopyHistoryQuery = (item: HistoryItem) => {
        // If no active tab, open the history item in a new tab instead
        if (!activeTabId) {
            handleSelectHistory(item);
            return;
        }

        setTabs(prev => prev.map(t => {
            if (t.id === activeTabId) {
                return { ...t, query: t.query ? `${t.query}\n\n${item.query}` : item.query };
            }
            return t;
        }));
    };

    const handleDeleteHistory = async (item: HistoryItem) => {
        await historyService.deleteHistoryItem(item);
        setHistory(prev => prev.filter(h => h.id !== item.id));
    };


    const executeActiveQuery = () => {
        if (!activeTab || !activeTabId) return;

        let queryToRun = activeTab.query;
        if (cursorPositionRef.current !== null) {
            const paragraph = extractParagraphAtCursor(activeTab.query, cursorPositionRef.current);
            // If paragraph found and not empty, use it. Otherwise use full query if necessary?
            // User requirement: "execute only one". So if cursor found, we respect it.
            // If paragraph is empty string (cursor on empty line), we might choose to do nothing
            // or run nothing. Here we run it (which will result in empty result or error or nothing).
            // But Cosmos query might error on empty string.
            // Let's filter:
            if (paragraph.trim()) {
                queryToRun = paragraph;
            }
        }

        handleRunQuery(queryToRun, activeTab.pageSize);
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
                sidebarWidth={sidebarWidth}
                onSidebarMouseDown={handleSidebarMouseDown}
                sidebarResizeHandleRef={sidebarResizeHandleRef}
                isDraggingSidebar={activeDrag === 'sidebar'}
                onSidebarHandleKeyDown={handleSidebarHandleKeyDown}
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
                        history={history.filter(h => h.accountName === accountName)}
                        onSelectHistory={handleSelectHistory}
                        onCopyHistory={handleCopyHistoryQuery}
                        onDeleteHistory={handleDeleteHistory}
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
                                cursorPositionRef={cursorPositionRef}
                            />
                        </div>

                        <div
                            ref={queryResizeHandleRef}
                            className={`resize-handle ${activeDrag === 'query' ? 'dragging' : ''}`}
                            onMouseDown={handleQueryMouseDown}
                            tabIndex={0}
                            title="Resize Query Pane (Ctrl+M)"
                            onKeyDown={handleQueryHandleKeyDown}
                        >
                            <div className="resize-handle-grabber" />
                        </div>

                        <ResultsView
                            results={activeTab?.results || []}
                            loading={activeTab?.isQuerying || false}
                            onRunQuery={executeActiveQuery}
                            pageSize={activeTab?.pageSize || 10}
                            onPageSizeChange={handlePageSizeChange}
                            error={activeTab?.error}
                            onDismissError={handleDismissError}
                            hasMoreResults={activeTab?.hasMoreResults}
                        />
                    </>
                }
            />
        </ThemeProvider>
    );
}

export default App;
