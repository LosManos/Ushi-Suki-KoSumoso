import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { QueryEditor } from './components/QueryEditor';
import { ResultsView } from './components/ResultsView';
import { ConnectionForm } from './components/ConnectionForm';
import { CommandPalette } from './components/CommandPalette';
import { FollowLinkDialog } from './components/FollowLinkDialog';
import { cosmos } from './services/cosmos';
import { ThemeProvider } from './context/ThemeContext';
import { QueryTab, HistoryItem } from './types';
import { historyService } from './services/history';
import { templateService } from './services/templates';
import { schemaService } from './services/schema';
import { extractParagraphAtCursor, updateValueAtPath } from './utils';
import { linkService, LinkMapping } from './services/linkService';
import { translationService } from './services/translationService';
import { FlattenedItem } from './components/JsonTreeView';
import { UpdateBanner } from './components/UpdateBanner';
import { TranslationDialog } from './components/TranslationDialog';
import { ChangelogDialog } from './components/ChangelogDialog';
import './App.css';

function App() {
    const [isConnected, setIsConnected] = useState(false);
    const [databases, setDatabases] = useState<string[]>([]);
    const [containers, setContainers] = useState<Record<string, string[]>>({});

    // View State for Sidebar (Expanded DB)
    const [sidebarDatabaseId, setSidebarDatabaseId] = useState<string | null>(null);

    // Tab State
    const [tabs, setTabs] = useState<QueryTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    const [accountName, setAccountName] = useState('Cosmos DB');
    const [history, setHistory] = useState<HistoryItem[]>([]);

    // Command Palette State
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

    // Follow Link State
    const [followLinkItem, setFollowLinkItem] = useState<{ item: FlattenedItem; sourceTabId: string; sourceKey: string } | null>(null);

    const cursorPositionRef = React.useRef<number | null>(null);

    // Track active query IDs per tab for cancellation
    const activeQueryIdsRef = React.useRef<Map<string, string>>(new Map());

    // Store templates per container (loaded from disk)
    const storedTemplatesRef = React.useRef<Record<string, string>>({});
    // Store schemas per container (loaded from disk)
    const storedSchemasRef = React.useRef<Record<string, string[]>>({});
    // Store link mappings (loaded from disk)
    const [storedLinks, setStoredLinks] = useState<Record<string, LinkMapping>>({});
    // Store translations (loaded from disk)
    const [translations, setTranslations] = useState<any>({});
    // Translation Dialog State
    const [translationItem, setTranslationItem] = useState<{ item: FlattenedItem; sourceTabId: string; propertyPath: string } | null>(null);

    // Update State
    const [updateInfo, setUpdateInfo] = useState<{ isNewer: boolean; latestVersion: string; url: string } | null>(null);
    const [showUpdateBanner, setShowUpdateBanner] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);

    // Load history, templates and schemas on startup
    useEffect(() => {
        historyService.getHistory().then(res => {
            if (res.success && res.data) {
                setHistory(res.data);
            }
        });
        templateService.getTemplates().then(res => {
            if (res.success && res.data) {
                storedTemplatesRef.current = res.data;
            }
        });
        schemaService.getSchemas().then(res => {
            if (res.success && res.data) {
                storedSchemasRef.current = res.data;
            }
        });
        linkService.getLinks().then(res => {
            if (res.success && res.data) {
                setStoredLinks(res.data);
            }
        });
        translationService.getTranslations().then(res => {
            if (res.success && res.data) {
                setTranslations(res.data);
            }
        });

        // Check for updates
        window.ipcRenderer.invoke('app:checkUpdate').then(res => {
            if (res && res.isNewer) {
                setUpdateInfo(res);
                setShowUpdateBanner(true);
            }
        });

        // Check if we should show the changelog (first run after update)
        window.ipcRenderer.invoke('app:getVersion').then(version => {
            const lastSeenVersion = localStorage.getItem('lastSeenVersion');
            if (version && lastSeenVersion !== version) {
                // If it's the very first time (lastSeenVersion is null), we might not want to show it?
                // Or maybe we do show it to let them know what's in the current version.
                // Let's only show if lastSeenVersion was set (meaning they had a previous version).
                if (lastSeenVersion) {
                    setShowChangelog(true);
                }
                localStorage.setItem('lastSeenVersion', version);
            }
        });
    }, []);

    // Use a ref to track the current activeTabId for the IPC listener
    const activeTabIdRef = React.useRef<string | null>(null);
    activeTabIdRef.current = activeTabId;

    // Listen for Cmd+W from main process to close active tab (only on mount)
    useEffect(() => {
        const handleCloseTab = () => {
            const tabIdToClose = activeTabIdRef.current;
            if (tabIdToClose) {
                setTabs(prev => {
                    const newTabs = prev.filter(t => t.id !== tabIdToClose);
                    // Switch to the last remaining tab or null
                    const lastTab = newTabs[newTabs.length - 1];
                    setActiveTabId(lastTab ? lastTab.id : null);
                    return newTabs;
                });
            }
        };

        const handleNewTab = () => {
            // Find the first available database to open a tab for
            if (databases.length > 0) {
                handleSelectContainer(databases[0], 'Documents'); // Default or placeholder
            }
        };

        const handleShowChangelog = () => {
            setShowChangelog(true);
        };

        window.ipcRenderer.on('close-active-tab', handleCloseTab);
        window.ipcRenderer.on('menu:new-tab', handleNewTab);
        window.ipcRenderer.on('menu:show-changelog', handleShowChangelog);
        // Note: cleanup may not work due to preload `off` bug, but we only register once
        return () => {
            window.ipcRenderer.off('close-active-tab', handleCloseTab);
            window.ipcRenderer.off('menu:new-tab', handleNewTab);
            window.ipcRenderer.off('menu:show-changelog', handleShowChangelog);
        };
    }, []); // Empty dependency - register only once

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
            // Handle Ctrl+P (or Cmd+P) to open command palette
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                setIsCommandPaletteOpen(true);
            }
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
            document.title = `Kosumoso - ${activeTab.containerId}`;
        } else {
            document.title = 'Kosumoso';
        }
    }, [activeTab?.containerId]);

    const handleConnect = async (connStr: string) => {
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

    // Load containers for a database
    const loadContainers = React.useCallback(async (dbId: string) => {
        if (!containers[dbId]) {
            const result = await cosmos.getContainers(dbId);
            if (result.success && result.data) {
                setContainers(prev => ({ ...prev, [dbId]: result.data! }));
            }
        }
    }, [containers]);

    const handleSelectContainer = (dbId: string, containerId: string) => {
        if (!containerId || !dbId) return;

        const newTabId = `${dbId}/${containerId}`;
        const storageKey = `${accountName}/${newTabId}`;
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
                pageSize: 10,
                template: storedTemplatesRef.current[storageKey] || '',
                schemaKeys: storedSchemasRef.current[storageKey] || []
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

        // Generate a unique query ID for cancellation support
        const queryId = crypto.randomUUID();
        activeQueryIdsRef.current.set(activeTabId, queryId);

        // Set isQuerying
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isQuerying: true } : t));

        const result = await cosmos.query(activeTab.databaseId, activeTab.containerId, query, pageSize, queryId);

        // Clean up query ID
        activeQueryIdsRef.current.delete(activeTabId);

        // If the query was cancelled, don't update state with error or add to history
        if (!result.success && (result as any).cancelled) {
            setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isQuerying: false } : t));
            return;
        }

        // Add to history (only for successful or non-cancelled queries)
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

    const handleCancelQuery = async () => {
        if (!activeTabId) return;

        const queryId = activeQueryIdsRef.current.get(activeTabId);
        if (queryId) {
            await cosmos.cancelQuery(queryId);
            activeQueryIdsRef.current.delete(activeTabId);
        }
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

    useEffect(() => {
        const handleFocus = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            // Don't track resize handles as "where I was" for error dismissal
            if (target && target.classList && !target.className.includes('resize-handle')) {
                lastFocusedElementRef.current = target;
            }
        };
        window.addEventListener('focusin', handleFocus);
        return () => window.removeEventListener('focusin', handleFocus);
    }, []);

    const handleDismissError = () => {
        if (!activeTabId) return;
        setTabs(prev => prev.map(t =>
            t.id === activeTabId ? { ...t, error: undefined } : t
        ));

        // Restore focus to where we were
        setTimeout(() => {
            if (lastFocusedElementRef.current && document.contains(lastFocusedElementRef.current)) {
                lastFocusedElementRef.current.focus();
            } else {
                document.getElementById('query-editor-textarea')?.focus();
            }
        }, 0);
    };

    const handleSelectHistory = (item: HistoryItem) => {
        const tabId = `${item.databaseId}/${item.containerId}`;
        const storageKey = `${item.accountName}/${tabId}`;

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
                    pageSize: 10,
                    template: storedTemplatesRef.current[storageKey] || '',
                    schemaKeys: storedSchemasRef.current[storageKey] || []
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

    const handleDiscoverSchema = async () => {
        if (!activeTab || !activeTabId) return;

        const storageKey = `${accountName}/${activeTabId}`;

        // Set isDiscovering to true
        setTabs(prev => prev.map(t =>
            t.id === activeTabId ? { ...t, isDiscovering: true } : t
        ));

        const result = await cosmos.getContainerKeys(activeTab.databaseId, activeTab.containerId);

        if (result.success && result.data) {
            const keys = result.data;
            setTabs(prev => prev.map(t =>
                t.id === activeTabId ? { ...t, schemaKeys: keys, isDiscovering: false } : t
            ));
            // Update ref and persist to disk
            storedSchemasRef.current[storageKey] = keys;
            schemaService.saveSchema(storageKey, keys);
        } else {
            setTabs(prev => prev.map(t =>
                t.id === activeTabId ? { ...t, error: result.error, isDiscovering: false } : t
            ));
        }
    };

    const handleFollowLink = (item: FlattenedItem, forceDialog = false) => {
        if (!activeTabId) return;

        // Construct a source key for link persistence
        const propertyPath = item.path.filter((p: any) => p !== 'root' && typeof p !== 'number').join('.');
        const sourceKey = `${accountName}/${activeTabId}:${propertyPath}`;
        const mapping = item.linkTarget || storedLinks[sourceKey];

        // If we have a mapping and NOT forcing the dialog, follow it immediately
        if (mapping && !forceDialog) {
            executeFollowLink(mapping.targetDb, mapping.targetContainer, mapping.targetPropertyName, {
                item,
                sourceTabId: activeTabId,
                sourceKey
            });
            return;
        }

        setFollowLinkItem({ item, sourceTabId: activeTabId, sourceKey });
    };

    const executeFollowLink = async (dbId: string, containerId: string, propertyName: string, context: { item: FlattenedItem; sourceTabId: string; sourceKey: string }) => {
        const { item, sourceTabId, sourceKey } = context;
        const targetValue = item.linkedValue !== undefined ? item.linkedValue : item.value;
        const path = item.path;

        // Save link mapping for persistence if it's new
        if (sourceKey) {
            const mapping: LinkMapping = {
                targetDb: dbId,
                targetContainer: containerId,
                targetPropertyName: propertyName
            };
            setStoredLinks(prev => ({ ...prev, [sourceKey]: mapping }));
            linkService.saveLink(sourceKey, mapping);
        }

        // Run query to follow link
        // We use a safe property accessor for Cosmos DB
        const propertyAccessor = propertyName.split('.').map(p => `["${p}"]`).join('');

        // Use single quotes for string literals in Cosmos SQL
        // Escape single quotes by doubling them
        let escapedValue;
        if (typeof targetValue === 'string') {
            escapedValue = `'${targetValue.replace(/'/g, "''")}'`;
        } else if (targetValue === null) {
            escapedValue = 'null';
        } else {
            escapedValue = targetValue;
        }

        const query = `SELECT * FROM c WHERE c${propertyAccessor} = ${escapedValue}`;

        // Set isQuerying to true for visual feedback on the source tab
        setTabs(prev => prev.map(t => t.id === sourceTabId ? { ...t, isQuerying: true } : t));

        const result = await cosmos.query(dbId, containerId, query, 100);

        if (result.success && result.data) {
            const linkedData = result.data.items;

            setTabs(prev => prev.map(t => {
                if (t.id !== sourceTabId) return t;

                const originalResults = t.results;
                let updatedResults;

                // Create a wrapper that preserves the original value
                const wrappedValue = {
                    __isLinked__: true,
                    originalValue: targetValue,
                    linkedData: linkedData
                };

                if (path.length > 1) {
                    // Directly replace the value at path with the wrapped data
                    updatedResults = updateValueAtPath(originalResults, path, wrappedValue);
                } else {
                    // Root
                    updatedResults = [wrappedValue];
                }

                return {
                    ...t,
                    isQuerying: false,
                    results: updatedResults
                };
            }));
        } else {
            setTabs(prev => prev.map(t => t.id === sourceTabId ? {
                ...t,
                isQuerying: false,
                error: `Error following link in ${dbId}/${containerId}.\nQuery: ${query}\nError: ${result.error || 'Unknown error'}`
            } : t));
        }
    };

    const confirmFollowLink = async (dbId: string, containerId: string, propertyName: string) => {
        if (!followLinkItem) return;
        const context = followLinkItem;
        setFollowLinkItem(null);
        await executeFollowLink(dbId, containerId, propertyName, context);
    };

    const handleAddTranslation = (item: FlattenedItem) => {
        if (!activeTabId) return;
        // Skip 'root' and any numeric path segments (array indices)
        const propertyPath = item.path.filter((p: any) => p !== 'root' && isNaN(Number(p))).join('.');
        if (!propertyPath) return;
        setTranslationItem({ item, sourceTabId: activeTabId, propertyPath });
    };

    const confirmTranslation = async (translation: string) => {
        if (!translationItem || !activeTabId) return;
        const { item, propertyPath } = translationItem;
        const [dbId, containerId] = activeTabId.split('/');

        const result = await translationService.saveTranslation(accountName, activeTabId, propertyPath, item.value, translation);
        if (result.success) {
            // Update local state (maintaining hierarchy)
            setTranslations((prev: any) => {
                const newTranslations = { ...prev };
                if (!newTranslations[accountName]) newTranslations[accountName] = {};
                if (!newTranslations[accountName][dbId]) newTranslations[accountName][dbId] = {};
                if (!newTranslations[accountName][dbId][containerId]) newTranslations[accountName][dbId][containerId] = {};
                if (!newTranslations[accountName][dbId][containerId][propertyPath]) newTranslations[accountName][dbId][containerId][propertyPath] = {};

                const valueKey = String(item.value);
                if (translation && translation.trim()) {
                    newTranslations[accountName][dbId][containerId][propertyPath][valueKey] = translation;
                } else {
                    delete newTranslations[accountName][dbId][containerId][propertyPath][valueKey];
                    // Cleanup
                    if (Object.keys(newTranslations[accountName][dbId][containerId][propertyPath]).length === 0) {
                        delete newTranslations[accountName][dbId][containerId][propertyPath];
                    }
                    if (Object.keys(newTranslations[accountName][dbId][containerId]).length === 0) {
                        delete newTranslations[accountName][dbId][containerId];
                    }
                }
                return newTranslations;
            });
        }
        setTranslationItem(null);
    };


    const executeActiveQuery = () => {
        if (!activeTab || !activeTabId) return;

        // If already querying, cancel instead of running
        if (activeTab.isQuerying) {
            handleCancelQuery();
            return;
        }

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
                <div className="app-container">
                    {showUpdateBanner && updateInfo && (
                        <UpdateBanner
                            version={updateInfo.latestVersion}
                            url={updateInfo.url}
                            onClose={() => setShowUpdateBanner(false)}
                            onShowChangelog={() => setShowChangelog(true)}
                        />
                    )}
                    <ConnectionForm
                        onConnect={handleConnect}
                        onCancel={databases.length > 0 ? () => setIsConnected(true) : undefined}
                        onShowChangelog={() => setShowChangelog(true)}
                        updateInfo={updateInfo}
                    />
                    {showChangelog && (
                        <ChangelogDialog onClose={() => setShowChangelog(false)} />
                    )}
                </div>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider>
            <div className="app-container">
                {showUpdateBanner && updateInfo && (
                    <UpdateBanner
                        version={updateInfo.latestVersion}
                        url={updateInfo.url}
                        onClose={() => setShowUpdateBanner(false)}
                        onShowChangelog={() => setShowChangelog(true)}
                    />
                )}
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
                            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                            history={history.filter(h => h.accountName === accountName)}
                            onSelectHistory={handleSelectHistory}
                            onCopyHistory={handleCopyHistoryQuery}
                            onDeleteHistory={handleDeleteHistory}
                            onShowChangelog={() => setShowChangelog(true)}
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
                                    onDiscoverSchema={handleDiscoverSchema}
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
                                onCancelQuery={handleCancelQuery}
                                pageSize={activeTab?.pageSize || 10}
                                onPageSizeChange={handlePageSizeChange}
                                error={activeTab?.error}
                                onDismissError={handleDismissError}
                                hasMoreResults={activeTab?.hasMoreResults}
                                template={activeTab?.template || ''}
                                onTemplateChange={(newTemplate) => {
                                    if (!activeTabId) return;
                                    const storageKey = `${accountName}/${activeTabId}`;
                                    setTabs(prev => prev.map(t =>
                                        t.id === activeTabId ? { ...t, template: newTemplate } : t
                                    ));
                                    // Update ref and persist to disk
                                    storedTemplatesRef.current[storageKey] = newTemplate;
                                    templateService.saveTemplate(storageKey, newTemplate);
                                }}
                                onFollowLink={handleFollowLink}
                                storedLinks={storedLinks}
                                accountName={accountName}
                                activeTabId={activeTabId || ''}
                                translations={(() => {
                                    if (!activeTabId) return {};
                                    const [dbId, containerId] = activeTabId.split('/');
                                    return (translations[accountName] as any)?.[dbId]?.[containerId] || {};
                                })()}
                                onAddTranslation={handleAddTranslation}
                            />
                        </>
                    }
                />
                <CommandPalette
                    isOpen={isCommandPaletteOpen}
                    onClose={() => setIsCommandPaletteOpen(false)}
                    databases={databases}
                    containers={containers}
                    onSelectContainer={handleSelectContainer}
                    loadContainers={loadContainers}
                />
                {followLinkItem && (
                    <FollowLinkDialog
                        databases={databases}
                        containers={containers}
                        currentDbId={tabs.find(t => t.id === followLinkItem.sourceTabId)?.databaseId || ''}
                        currentContainerId={tabs.find(t => t.id === followLinkItem.sourceTabId)?.containerId || ''}
                        selectedValue={followLinkItem.item.linkedValue !== undefined ? followLinkItem.item.linkedValue : followLinkItem.item.value}
                        suggestedMapping={storedLinks[followLinkItem.sourceKey]}
                        onDatabaseChange={loadContainers}
                        onClose={() => setFollowLinkItem(null)}
                        onConfirm={confirmFollowLink}
                    />
                )}
                {translationItem && (
                    <TranslationDialog
                        propertyPath={translationItem.propertyPath}
                        value={translationItem.item.value}
                        currentTranslation={(() => {
                            if (!activeTabId) return undefined;
                            const [dbId, containerId] = activeTabId.split('/');
                            return (translations[accountName] as any)?.[dbId]?.[containerId]?.[translationItem.propertyPath]?.[String(translationItem.item.value)];
                        })()}
                        onClose={() => setTranslationItem(null)}
                        onConfirm={confirmTranslation}
                    />
                )}
                {showChangelog && (
                    <ChangelogDialog onClose={() => setShowChangelog(false)} />
                )}
            </div>
        </ThemeProvider>
    );
}

export default App;
