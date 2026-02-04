import React, { useRef, useEffect, useState } from 'react';
import { Play, Search, Terminal, Code, Sparkles, X } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import './QueryEditor.css';
import './QueryEditorOverflow.css';
import './SQLHighlight.css';
import { QueryTab } from '../types';
import { useContextMenu } from '../hooks/useContextMenu';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { fuzzyMatch } from '../utils';

// Extend Prism SQL for Cosmos DB specific functions if not already present
if (Prism.languages.sql) {
    Prism.languages.sql['function'] = {
        pattern: /\b(?:AVG|COUNT|FIRST|LAST|MAX|MIN|SUM|UCASE|LCASE|MID|LEN|ROUND|NOW|FORMAT|GROUP_CONCAT|COALESCE|IFNULL|ISNULL|IS_ARRAY|IS_BOOL|IS_DEFINED|IS_NULL|IS_NUMBER|IS_OBJECT|IS_PRIMITIVE|IS_STRING|CONTAINS|ENDSWITH|INDEX_OF|LEFT|LENGTH|LOWER|LTRIM|REPLACE|REPLICATE|REVERSE|RIGHT|RTRIM|STARTSWITH|SUBSTRING|UPPER|ABS|ACOS|ASIN|ATAN|ATN2|CEILING|COS|COT|DEGREES|EXP|FLOOR|LOG|LOG10|PI|POWER|RADIANS|ROUND|SIN|SQRT|SQUARE|TAN|TRUNC)\b(?=\s*\()/i,
        lookbehind: false
    };

    // Add a catch-all for any word followed by ( as a function
    // inserting it BEFORE the keyword to ensure function calls like count() are caught as functions
    Prism.languages.insertBefore('sql', 'keyword', {
        'function-call': {
            pattern: /\b[a-z_][a-z0-9_]*(?=\s*\()/i,
            alias: 'function'
        }
    });
}


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
    const [isHelperMode, setIsHelperMode] = useState(true);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 });
    const lastPartialRef = useRef<string | null>(null);

    // Derived state from active tab
    const activeTab = tabs.find(t => t.id === activeTabId);
    const query = activeTab?.query || '';

    // Automatically enable helper mode if a schema is known for the container
    useEffect(() => {
        if (activeTab) {
            const hasSchema = (activeTab.schemaKeys || []).length > 0;
            setIsHelperMode(hasSchema);
        }
    }, [activeTab?.id, (activeTab?.schemaKeys || []).length]);

    // We only need local refs for ID lookup now
    const quickIdInputRef = useRef<HTMLInputElement>(null);
    const propertySelectRef = useRef<HTMLSelectElement>(null);
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Overflow state
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const { contextMenu, showContextMenu, closeContextMenu } = useContextMenu();

    const appendQuery = (newQuery: string) => {
        const updatedQuery = query.trim() ? `${query}\n\n${newQuery}` : newQuery;
        onQueryChange(updatedQuery);
    };

    const handlePasteIdToQuery = async (quoted: boolean) => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                const queryToAppend = quoted ? `select * from c where c.id = '${text}'` : `select * from c where c.id = ${text}`;
                appendQuery(queryToAppend);
            }
        } catch (err) {
            console.error('Failed to read clipboard', err);
        }
    };

    const getContextMenuItems = (): ContextMenuItem[] => {
        return [
            { label: 'Run Query', icon: <Play size={16} />, shortcut: 'Shift+Enter', onClick: onRunQuery },
            { label: 'Discover Schema', icon: <Search size={16} />, onClick: onDiscoverSchema },
            { divider: true },
            { label: 'select * from c', icon: <Terminal size={16} />, onClick: () => appendQuery('select * from c') },
            { label: 'select count(1) from c', icon: <Terminal size={16} />, onClick: () => appendQuery('select count(1) from c') },
            { label: 'select * from c where c.id = ', icon: <Terminal size={16} />, onClick: () => appendQuery('select * from c where c.id = ""') },
            { divider: true },
            { label: "select * from c where c.id = '{clipboard}'", icon: <Terminal size={16} />, shortcut: '⌘⌥I', onClick: () => handlePasteIdToQuery(true) },
            { label: "select * from c where c.id = {clipboard}", icon: <Terminal size={16} />, shortcut: '⌘⌥⇧I', onClick: () => handlePasteIdToQuery(false) },
        ];
    };

    useEffect(() => {
        if (activeTabId) {
            const textarea = document.getElementById('query-editor-textarea') as HTMLTextAreaElement;
            if (textarea) {
                textarea.focus();
                if (cursorPositionRef && cursorPositionRef.current !== null) {
                    textarea.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
                }
            }
        }
    }, [activeTabId, cursorPositionRef]);

    const updateCursorPosition = () => {
        const textarea = document.getElementById('query-editor-textarea') as HTMLTextAreaElement;
        if (textarea && cursorPositionRef) {
            cursorPositionRef.current = textarea.selectionStart;
        }

        if (isHelperMode && textarea) {
            handleSuggestions(textarea);
        } else {
            setShowSuggestions(false);
        }
    };

    const handleSuggestions = (textarea: HTMLTextAreaElement) => {
        const pos = textarea.selectionStart;
        const text = textarea.value;
        const textBefore = text.slice(0, pos);

        // Match "c." followed by optional partial property name (including *)
        const match = textBefore.match(/c\.([a-zA-Z0-9_*]*)$/);

        if (match && activeTab?.schemaKeys) {
            const partial = match[1];

            // Only update suggestions if the partial text has changed
            // This prevents resetting the suggestionIndex to 0 on every cursor update (like Arrow keys)
            // AND prevents re-opening on KeyUp if Escape was just pressed (which sets showSuggestions to false but keeps partial the same)
            if (partial === lastPartialRef.current) {
                return;
            }
            lastPartialRef.current = partial;

            const lowerPartial = partial.toLowerCase();
            const allPossibleKeys = ['*', ...activeTab.schemaKeys];

            // Prioritize: 
            // 1. Starts with partial
            // 2. Contains partial
            // 3. Fuzzy match
            const startsWithItems = allPossibleKeys.filter(key => key.toLowerCase().startsWith(lowerPartial));
            const containsItems = allPossibleKeys.filter(key =>
                !key.toLowerCase().startsWith(lowerPartial) &&
                key.toLowerCase().includes(lowerPartial)
            );
            const fuzzyItems = allPossibleKeys.filter(key =>
                !key.toLowerCase().includes(lowerPartial) &&
                fuzzyMatch(partial, key)
            );

            const suggestions = [...startsWithItems, ...containsItems, ...fuzzyItems].slice(0, 100);

            if (suggestions.length > 0) {
                setFilteredSuggestions(suggestions);
                setSuggestionIndex(0);
                setShowSuggestions(true);

                // Calculate position
                const { top, left } = getCaretCoordinates(textarea, pos);
                setSuggestionPosition({ top, left });
            } else {
                setShowSuggestions(false);
                lastPartialRef.current = null;
            }
        } else {
            setShowSuggestions(false);
            lastPartialRef.current = null;
        }
    };

    // Helper to get caret coordinates
    const getCaretCoordinates = (_textarea: HTMLTextAreaElement, _pos: number) => {
        // This is a rough estimation since real caret positioning is complex without a library
        // We can use a mirror div if we want more accuracy, but for now let's try 
        // a simple approach or a fixed position.
        // Actually, let's use a fixed position for the suggestion box 
        // relative to the editor area to keep it simple and robust.
        return {
            top: 40, // Below the toolbar
            left: 20 // Fixed relative position
        };
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + Enter OR Shift + Enter to run query
            if (((e.metaKey || e.ctrlKey) && e.key === 'Enter') || (e.shiftKey && e.key === 'Enter')) {
                e.preventDefault();
                updateCursorPosition();
                onRunQuery();
            }
            // Cmd/Ctrl + Shift + I to focus ID lookup
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                quickIdInputRef.current?.focus();
            }

            // Quoted ID query from clipboard (Cmd + Opt + I)
            // On Mac, Alt (Option) produces special characters in e.key, so we use e.code
            if ((e.metaKey || e.ctrlKey) && e.altKey && !e.shiftKey && e.code === 'KeyI') {
                e.preventDefault();
                handlePasteIdToQuery(true);
            }

            // Unquoted ID query from clipboard (Cmd + Opt + Shift + I)
            if ((e.metaKey || e.ctrlKey) && e.altKey && e.shiftKey && e.code === 'KeyI') {
                e.preventDefault();
                handlePasteIdToQuery(false);
            }

            // Cmd/Ctrl + E to focus query editor
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                document.getElementById('query-editor-textarea')?.focus();
            }
            // Cmd/Ctrl + Shift + K to focus property lookup
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                propertySelectRef.current?.focus();
            }

            // Cmd/Ctrl + Shift + H to toggle helper mode
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                setIsHelperMode(prev => !prev);
                document.getElementById('query-editor-textarea')?.focus();
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
                            updateCursorPosition();
                            onTabSelect(tabs[num - 1].id);
                        }
                    } else if (num === 9) {
                        // Switch to last tab
                        if (tabs.length > 0) {
                            updateCursorPosition();
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
                    updateCursorPosition();
                    onTabSelect(tabs[prevIndex].id);
                } else {
                    // Next tab (round robin)
                    const nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
                    updateCursorPosition();
                    onTabSelect(tabs[nextIndex].id);
                }
            }

            // Handle Suggestions navigation
            if (showSuggestions) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSuggestionIndex(prev => (prev + 1) % filteredSuggestions.length);
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSuggestionIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
                    return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    insertSuggestion(filteredSuggestions[suggestionIndex]);
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSuggestions(false);
                    // Keep lastPartialRef as is so it doesn't re-open on KeyUp
                    document.getElementById('query-editor-textarea')?.focus();
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [query, onRunQuery, tabs, onTabSelect, showSuggestions, filteredSuggestions, suggestionIndex, isHelperMode]);

    const insertSuggestion = (suggestion: string) => {
        const textarea = document.getElementById('query-editor-textarea') as HTMLTextAreaElement;
        if (!textarea) return;

        const pos = textarea.selectionStart;
        const text = textarea.value;
        const textBefore = text.slice(0, pos);
        const textAfter = text.slice(pos);

        // Find where the "c." or "c.partial" starts
        const match = textBefore.match(/c\.[a-zA-Z0-9_*]*$/);
        if (!match) return;

        let startPos, replacement;
        if (suggestion === '*') {
            startPos = match.index!;
            replacement = '*';
        } else {
            startPos = match.index! + 2; // After "c."
            replacement = suggestion;
        }

        const newText = text.slice(0, startPos) + replacement + textAfter;
        onQueryChange(newText);
        setShowSuggestions(false);
        lastPartialRef.current = suggestion; // Prevent re-opening for this property immediately

        // Set cursor position after the inserted suggestion
        setTimeout(() => {
            const newPos = startPos + replacement.length;
            textarea.focus();
            textarea.setSelectionRange(newPos, newPos);
            if (cursorPositionRef) cursorPositionRef.current = newPos;
        }, 0);
    };

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

        // Construct query: select * from c where c.{property} = {value}
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
                                    <X size={14} />
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
                            title="Filter by property (Cmd/Ctrl+Shift+K)"
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

                    <label title="Focus ID Lookup (Cmd/Ctrl+Shift+I)">Get by Document Id:</label>
                    <input
                        ref={quickIdInputRef}
                        type="text"
                        placeholder="Quick ID Lookup..."
                        value={quickId}
                        onChange={(e) => setQuickId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickLookup()}
                        title="Focus ID Lookup (Cmd/Ctrl+Shift+I)"
                    />
                    <button onClick={handleQuickLookup}>Get</button>

                    <div className="id-lookup-separator"></div>

                    <button
                        className={`helper-mode-btn ${isHelperMode ? 'active' : ''}`}
                        onClick={() => setIsHelperMode(!isHelperMode)}
                        title="Toggle Query Helper Mode - Property Suggestions (Cmd/Ctrl+Shift+H)"
                    >
                        <Sparkles size={16} />
                        <span>{isHelperMode ? 'Helper: On' : 'Helper: Off'}</span>
                    </button>
                </div>
            </div>
            <div className="editor-area">
                {showSuggestions && (
                    <div
                        className="query-suggestions-popup"
                        style={{
                            top: suggestionPosition.top,
                            right: 20 // Suggestion box on the right side
                        }}
                    >
                        <div className="suggestions-header">
                            Suggestions ({filteredSuggestions.length})
                        </div>
                        <div className="suggestions-list">
                            {filteredSuggestions.map((s, i) => (
                                <div
                                    key={s}
                                    className={`suggestion-item ${i === suggestionIndex ? 'selected' : ''}`}
                                    onClick={() => insertSuggestion(s)}
                                    onMouseEnter={() => setSuggestionIndex(i)}
                                >
                                    <Code size={12} className="suggestion-icon" />
                                    <span className="suggestion-text">{s}</span>
                                </div>
                            ))}
                        </div>
                        <div className="suggestions-footer">
                            ↑↓ to navigate, Enter to select
                        </div>
                    </div>
                )}
                <Editor
                    value={query}
                    onValueChange={(code) => onQueryChange(code)}
                    highlight={(code) => {
                        if (Prism.languages.sql) {
                            return Prism.highlight(code, Prism.languages.sql, 'sql');
                        }
                        // Fallback to plain text or basic escaping if SQL is not loaded
                        return code;
                    }}
                    padding={16}
                    className="code-editor"
                    textareaClassName="code-input"
                    textareaId="query-editor-textarea"
                    onSelect={updateCursorPosition}
                    onClick={updateCursorPosition}
                    onKeyUp={updateCursorPosition}
                    onContextMenu={(e) => showContextMenu(e)}
                    onKeyDown={(e) => {
                        if (e.shiftKey && e.key === 'F10') {
                            e.stopPropagation();
                            showContextMenu(e);
                        } else if (e.altKey && e.key === 'Enter') {
                            e.stopPropagation();
                            showContextMenu(e);
                        }
                    }}
                    placeholder="SELECT * FROM c"
                    title="Query Editor (Cmd/Ctrl+E)"
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
