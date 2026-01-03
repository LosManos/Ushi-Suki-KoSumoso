import React, { useRef, useEffect, useState } from 'react';
import { Play, Search } from 'lucide-react';
import './QueryEditor.css';
import './QueryEditorOverflow.css';
import { QueryTab } from '../types';
import { useContextMenu } from '../hooks/useContextMenu';
import { ContextMenu, ContextMenuItem } from './ContextMenu';


interface QueryEditorProps {
    tabs: QueryTab[];
    activeTabId: string | null;
    onTabSelect: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    onRunQuery: () => void;
    onGetDocument: (docId: string) => void;
    onQueryChange: (query: string) => void;
    onDiscoverSchema: () => void;
    cursorPositionRef?: React.MutableRefObject<number | null>;
}

export const QueryEditor: React.FC<QueryEditorProps> = ({
    tabs,
    activeTabId,
    onTabSelect,
    onTabClose,
    onRunQuery,
    onGetDocument,
    onQueryChange,
    onDiscoverSchema,
    cursorPositionRef
}) => {
    const [quickId, setQuickId] = useState('');
    const [selectedProperty, setSelectedProperty] = useState('');
    const [propertyValue, setPropertyValue] = useState('');

    // Derived state from active tab
    const activeTab = tabs.find(t => t.id === activeTabId);
    const query = activeTab?.query || '';

    // We only need local refs for text area and ID lookup now
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const quickIdInputRef = useRef<HTMLInputElement>(null);
    const propertySelectRef = useRef<HTMLSelectElement>(null);
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Overflow state
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const { contextMenu, showContextMenu, closeContextMenu } = useContextMenu();

    const getContextMenuItems = (): ContextMenuItem[] => {
        return [
            { label: 'Run Query', icon: <Play size={16} />, onClick: onRunQuery },
            { label: 'Discover Schema', icon: <Search size={16} />, onClick: onDiscoverSchema }
        ];
    };

    useEffect(() => {
        if (activeTabId && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [activeTabId]);

    const updateCursorPosition = () => {
        if (textareaRef.current && cursorPositionRef) {
            cursorPositionRef.current = textareaRef.current.selectionStart;
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + Enter to run query
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                updateCursorPosition();
                onRunQuery();
            }
            // Cmd/Ctrl + Shift + I to focus ID lookup
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                quickIdInputRef.current?.focus();
            }
            // Cmd/Ctrl + E to focus query editor
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                textareaRef.current?.focus();
            }
            // Cmd/Ctrl + Shift + K to focus property lookup
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                propertySelectRef.current?.focus();
            }

            // Tab Navigation Cmd+1 through Cmd+9
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
                const key = e.key;
                if (/^[1-9]$/.test(key)) {
                    e.preventDefault();
                    const num = parseInt(key, 10);
                    if (num >= 1 && num <= 8) {
                        // Switch to specific tab index 0-7
                        if (tabs[num - 1]) {
                            onTabSelect(tabs[num - 1].id);
                        }
                    } else if (num === 9) {
                        // Switch to last tab
                        if (tabs.length > 0) {
                            onTabSelect(tabs[tabs.length - 1].id);
                        }
                    }
                }
            }

            // Ctrl+Tab and Shift+Ctrl+Tab Navigation
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation(); // Important to stop focus ring movement if possible, though Ctrl+Tab is usually browser level

                if (tabs.length <= 1) return;

                const currentIndex = tabs.findIndex(t => t.id === activeTabId);
                if (currentIndex === -1) return;

                if (e.shiftKey) {
                    // Previous tab (round robin)
                    const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
                    onTabSelect(tabs[prevIndex].id);
                } else {
                    // Next tab (round robin)
                    const nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
                    onTabSelect(tabs[nextIndex].id);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [query, onRunQuery, tabs, onTabSelect]);

    // Check for overflow on resize and tabs change
    useEffect(() => {
        const checkOverflow = () => {
            if (tabsContainerRef.current) {
                const { scrollWidth, clientWidth } = tabsContainerRef.current;
                // We add a small buffer (e.g. 1px) to avoid precision issues
                setIsOverflowing(scrollWidth > clientWidth + 1);
            }
        };

        const resizeObserver = new ResizeObserver(checkOverflow);
        if (tabsContainerRef.current) {
            resizeObserver.observe(tabsContainerRef.current);
        }

        checkOverflow();

        return () => resizeObserver.disconnect();
    }, [tabs]);

    // Click outside to close menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    const handleQuickLookup = () => {
        if (!quickId.trim()) return;
        onGetDocument(quickId.trim());
    };

    const handlePropertyLookup = () => {
        if (!selectedProperty || !propertyValue.trim()) return;

        // Construct query: select * from c where c.{property} == {value}
        // Using bracket notation for property name to handle special characters or nested paths
        // However, if it's already a dotted path from discovery, we might need to handle it.
        // Cosmos SQL supports c.path.to.prop or c["path"]["to"]["prop"].
        // For simplicity and correctness with dots:
        const propertyPath = selectedProperty.split('.').map(p => `["${p}"]`).join('');
        const formattedValue = isNaN(Number(propertyValue)) ? `"${propertyValue}"` : propertyValue;

        const newQuery = `SELECT * FROM c WHERE c${propertyPath} = ${formattedValue}`;

        // Append to the bottom of the query window
        const updatedQuery = query.trim() ? `${query}\n\n${newQuery}` : newQuery;
        onQueryChange(updatedQuery);
    };

    const handlePropertySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '__reinit__') {
            onDiscoverSchema();
            setSelectedProperty('');
        } else {
            setSelectedProperty(val);
        }
    };

    if (!activeTab) {
        return <div className="query-editor-container placeholder">Please select a container to start querying.</div>;
    }

    return (
        <div className="query-editor-container">
            <div className="editor-toolbar">
                <div className="tabs-container" ref={tabsContainerRef}>
                    {tabs.map((tab, index) => {
                        let shortcut = '';
                        if (index < 8) {
                            shortcut = ` (Cmd+${index + 1})`;
                        } else if (index === tabs.length - 1) {
                            shortcut = ' (Cmd+9)';
                        }

                        return (
                            <span
                                key={tab.id}
                                className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
                                onClick={() => onTabSelect(tab.id)}
                                title={`${tab.databaseId} / ${tab.containerId}${shortcut}`}
                            >
                                {tab.containerId}
                                <button
                                    className="close-tab-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabClose(tab.id);
                                    }}
                                    title="Close Tab"
                                >
                                    ×
                                </button>
                            </span>
                        )
                    })}
                </div>

                {isOverflowing && (
                    <div className="tabs-overflow-control" ref={menuRef}>
                        <button
                            className={`overflow-btn ${showDropdown ? 'active' : ''}`}
                            onClick={() => setShowDropdown(!showDropdown)}
                            title="Show all tabs"
                        >
                            ▼
                        </button>
                        {showDropdown && (
                            <div className="tabs-dropdown-menu">
                                {tabs.map(tab => (
                                    <div
                                        key={tab.id}
                                        className={`dropdown-item ${tab.id === activeTabId ? 'active' : ''}`}
                                        onClick={() => {
                                            onTabSelect(tab.id);
                                            setShowDropdown(false);
                                        }}
                                        title={`${tab.databaseId} / ${tab.containerId}`}
                                    >
                                        {tab.containerId}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="quick-lookup">
                    <div className={`property-lookup ${activeTab.isDiscovering ? 'discovering' : ''}`}>
                        <select
                            ref={propertySelectRef}
                            value={selectedProperty}
                            onChange={handlePropertySelectChange}
                            title="Filter by property (Cmd+Shift+K)"
                            className="property-select"
                            disabled={activeTab.isDiscovering}
                        >
                            <option value="">{activeTab.isDiscovering ? 'Discovering...' : 'Select Property...'}</option>
                            {(activeTab.schemaKeys || []).map(key => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                            {(activeTab.schemaKeys || []).length > 0 && <option disabled>──────────</option>}
                            <option value="__reinit__">
                                {(activeTab.schemaKeys || []).length > 0 ? '↻ Reinitialize List...' : 'Initialize Properties...'}
                            </option>
                        </select>
                        <input
                            type="text"
                            placeholder="Value..."
                            value={propertyValue}
                            onChange={(e) => setPropertyValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handlePropertyLookup()}
                            title="Property value"
                            className="property-value-input"
                            disabled={activeTab.isDiscovering}
                        />
                        <button
                            onClick={handlePropertyLookup}
                            title="Append filter to query"
                            disabled={activeTab.isDiscovering}
                        >
                            {activeTab.isDiscovering ? '...' : 'Append'}
                        </button>
                    </div>

                    <div className="id-lookup-separator"></div>

                    <label title="Focus ID Lookup (Cmd+Shift+I)">Get by Document Id:</label>
                    <input
                        ref={quickIdInputRef}
                        type="text"
                        placeholder="Quick ID Lookup..."
                        value={quickId}
                        onChange={(e) => setQuickId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickLookup()}
                        title="Focus ID Lookup (Cmd+Shift+I)"
                    />
                    <button onClick={handleQuickLookup}>Get</button>
                </div>
            </div>
            <div className="editor-area">
                <textarea
                    ref={textareaRef}
                    className="code-input"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    onSelect={updateCursorPosition}
                    onClick={updateCursorPosition}
                    onKeyUp={updateCursorPosition}
                    onContextMenu={(e) => showContextMenu(e)}
                    onKeyDown={(e) => {
                        if (e.shiftKey && e.key === 'F10') {
                            showContextMenu(e);
                        } else if (e.altKey && e.key === 'Enter') {
                            showContextMenu(e);
                        }
                    }}
                    placeholder="SELECT * FROM c"
                    title="Query Editor (Cmd+E)"
                />
            </div>
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={getContextMenuItems()}
                    onClose={closeContextMenu}
                />
            )}
        </div>
    );
};
