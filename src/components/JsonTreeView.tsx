import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronRight, ChevronDown, Copy, Link } from 'lucide-react';
import { useContextMenu } from '../hooks/useContextMenu';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { LinkMapping } from '../services/linkService';
import { ContainerTranslations } from '../services/translationService';
import './JsonTreeView.css';
import { Languages } from 'lucide-react';

// Helper to format value for clipboard
const formatValueForClipboard = (value: any): string => {
    if (value === null) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    return JSON.stringify(value, null, 2);
};

// Helper to get raw value (without quotes for strings)
const getRawValue = (value: any): string => {
    if (value === null) return 'null';
    if (typeof value === 'string') return value; // No quotes!
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    return JSON.stringify(value, null, 2);
};

// Helper to copy text to clipboard
const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
};

const isNumeric = (s: string) => s.length > 0 && !isNaN(Number(s));
const isSimilar = (k1: string, k2: string) => k1 === k2 || (isNumeric(k1) && isNumeric(k2));

interface JsonTreeViewProps {
    data: any;
    theme?: 'light' | 'dark';
    onFollowLink?: (item: FlattenedItem, forceDialog?: boolean) => void;
    storedLinks?: Record<string, any>;
    accountName?: string;
    activeTabId?: string;
    searchQuery?: string;
    searchIsRegex?: boolean;
    translations?: ContainerTranslations;
    onAddTranslation?: (item: FlattenedItem) => void;
}

export interface FlattenedItem {
    id: string;
    key: string;
    value: any;
    level: number;
    type: 'object' | 'array' | 'primitive';
    expanded?: boolean;
    hasChildren: boolean;
    path: string[];
    linkedValue?: any;
    linkTarget?: LinkMapping;
    isLinkedData?: boolean;
}

// Interface removed as we forward HTMLDivElement directly

export const JsonTreeView = React.forwardRef<HTMLDivElement, JsonTreeViewProps>(({
    data,
    theme = 'dark',
    onFollowLink,
    storedLinks = {},
    accountName = '',
    activeTabId = '',
    searchQuery = '',
    searchIsRegex = false,
    translations = {},
    onAddTranslation
}, ref) => {
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(['root']));
    const [focusedPath, setFocusedPath] = useState<string>('root');
    const [filterKey, setFilterKey] = useState<string | null>(null);
    const internalRef = useRef<HTMLDivElement | null>(null);
    const { contextMenu, showContextMenu, closeContextMenu } = useContextMenu();

    // Merge local and forwarded refs
    const setBufferRef = (element: HTMLDivElement | null) => {
        internalRef.current = element;
        if (typeof ref === 'function') {
            ref(element);
        } else if (ref) {
            (ref as any).current = element;
        }
    };

    const expandAll = (rootItem: FlattenedItem) => {
        const newKeys = new Set(expandedKeys);
        const traverse = (data: any, currentPath: string[]) => {
            if (data !== null && typeof data === 'object') {
                const pathStr = currentPath.join('.');
                newKeys.add(pathStr);
                Object.entries(data).forEach(([k, v]) => {
                    traverse(v, [...currentPath, k]);
                });
            }
        };
        traverse(rootItem.value, rootItem.path);
        setExpandedKeys(newKeys);
    };

    const collapseAll = (rootItem: FlattenedItem) => {
        const newKeys = new Set(expandedKeys);
        const pathStr = rootItem.path.join('.');
        const prefix = pathStr + '.';

        // Remove all keys that start with this prefix or are exactly this key
        Array.from(newKeys).forEach((key: string) => {
            if (key === pathStr || key.startsWith(prefix)) {
                newKeys.delete(key);
            }
        });
        setExpandedKeys(newKeys);
    };



    // Flatten the visible tree structure
    const flattenedItems = useMemo(() => {
        const items: FlattenedItem[] = [];

        // 1. Identify all paths that should be visible due to filtering
        const visiblePaths = new Set<string>();
        if (filterKey) {
            const findPaths = (obj: any, path: string[], isDescendantOfMatch: boolean): boolean => {
                const key = path[path.length - 1];
                const match = key && isSimilar(key, filterKey);
                const shouldShow = match || isDescendantOfMatch;

                let anyChildMatched = false;
                if (obj !== null && typeof obj === 'object') {
                    Object.entries(obj).forEach(([k, v]) => {
                        if (findPaths(v, [...path, k], shouldShow)) {
                            anyChildMatched = true;
                        }
                    });
                }

                if (shouldShow || anyChildMatched) {
                    visiblePaths.add(path.join('.'));
                    return true;
                }
                return false;
            };

            if (Array.isArray(data)) {
                data.forEach((item, i) => findPaths(item, ['root', String(i)], false));
            } else {
                findPaths(data, ['root'], false);
            }
            visiblePaths.add('root');
        }

        const traverse = (currentData: any, currentLevel: number, currentPath: string[], isLinkedData: boolean = false) => {
            const pathStr = currentPath.length === 0 ? 'root' : currentPath.join('.');

            // If filtering, only proceed if this path is in visiblePaths (or it's the root)
            if (filterKey && currentPath.length > 0 && !visiblePaths.has(pathStr)) {
                return;
            }

            let childrenIsLinkedData = isLinkedData;
            let itemIsLinkedData = isLinkedData;

            // Determine type
            let type: 'object' | 'array' | 'primitive' = 'primitive';
            let hasChildren = false;
            let displayData = currentData;
            let linkedValue = undefined;

            // Handle wrapped linked values
            if (currentData !== null && typeof currentData === 'object' && currentData.__isLinked__) {
                displayData = currentData.linkedData;
                linkedValue = currentData.originalValue;
                childrenIsLinkedData = true;
            }

            if (displayData !== null && typeof displayData === 'object') {
                type = Array.isArray(displayData) ? 'array' : 'object';
                hasChildren = Object.keys(displayData).length > 0;
            }

            // Forced expansion when filtering
            const isExpanded = filterKey ? true : expandedKeys.has(pathStr);

            if (currentPath.length === 0) {
                // Special case for root
                let rootDisplayData = data;
                let rootLinkedValue = undefined;
                let rootChildrenIsLinked = false;

                if (data !== null && typeof data === 'object' && data.__isLinked__) {
                    rootDisplayData = data.linkedData;
                    rootLinkedValue = data.originalValue;
                    rootChildrenIsLinked = true;
                }

                const rootType = Array.isArray(rootDisplayData) ? 'array' : (typeof rootDisplayData === 'object' && rootDisplayData !== null ? 'object' : 'primitive');
                const rootHasChildren = rootType !== 'primitive' && Object.keys(rootDisplayData).length > 0;
                items.push({
                    id: 'root',
                    key: 'root',
                    value: rootDisplayData,
                    level: 0,
                    type: rootType,
                    expanded: isExpanded,
                    hasChildren: rootHasChildren,
                    path: ['root'],
                    linkedValue: rootLinkedValue,
                    isLinkedData: false // Root itself is never highlighted as "linked result"
                });

                if (isExpanded && rootHasChildren) {
                    Object.entries(rootDisplayData).forEach(([k, v]) => {
                        traverse(v, 1, ['root', k], rootChildrenIsLinked);
                    });
                }
                return;
            }

            // For non-root items
            const key = currentPath[currentPath.length - 1];
            items.push({
                id: pathStr,
                key,
                value: displayData,
                level: currentLevel,
                type,
                expanded: isExpanded,
                hasChildren,
                path: currentPath,
                linkedValue,
                isLinkedData: itemIsLinkedData
            });

            if (isExpanded && hasChildren) {
                Object.entries(displayData).forEach(([k, v]) => {
                    traverse(v, currentLevel + 1, [...currentPath, k], childrenIsLinkedData);
                });
            }
        };

        // Initialize with data
        traverse(data, 0, []);

        // Post-process to mark isLinked based on storedLinks
        if (Object.keys(storedLinks).length > 0 && accountName && activeTabId) {
            items.forEach(item => {
                // Same logic as in App.tsx for sourceKey
                const propertyPath = item.path.filter((p: any) => p !== 'root' && isNaN(Number(p))).join('.');
                if (!propertyPath) return;
                const sourceKey = `${accountName}/${activeTabId}:${propertyPath}`;
                const mapping = storedLinks[sourceKey];
                if (mapping) {
                    item.linkTarget = mapping;
                }
            });
        }

        return items;
    }, [data, expandedKeys, storedLinks, accountName, activeTabId, filterKey]);

    const copyAllIsolatedValues = () => {
        if (!filterKey) return;
        const matchingValues = flattenedItems
            .filter(item => isSimilar(item.key, filterKey))
            .map(item => item.value);

        const text = JSON.stringify(matchingValues, null, 2);
        copyToClipboard(text);
    };


    const expandLevel = (item: FlattenedItem) => {
        const newKeys = new Set(expandedKeys);
        flattenedItems.forEach(other => {
            if (other.level === item.level && other.hasChildren && isSimilar(item.key, other.key)) {
                newKeys.add(other.id);
            }
        });
        setExpandedKeys(newKeys);
    };

    const collapseLevel = (item: FlattenedItem) => {
        const newKeys = new Set(expandedKeys);
        flattenedItems.forEach(other => {
            if (other.level === item.level && isSimilar(item.key, other.key)) {
                newKeys.delete(other.id);
            }
        });
        setExpandedKeys(newKeys);
    };

    const getContextMenuItems = (item: FlattenedItem): ContextMenuItem[] => {
        return [
            {
                label: 'Copy Key',
                accessKey: 'K',
                shortcut: '⌥K',
                icon: <Copy size={14} />,
                onClick: () => copyToClipboard(item.key)
            },
            {
                label: 'Copy Value',
                accessKey: 'V',
                shortcut: '⌥V',
                icon: <Copy size={14} />,
                onClick: () => copyToClipboard(formatValueForClipboard(item.value))
            },
            {
                label: 'Copy Raw Value',
                accessKey: 'R',
                shortcut: '⌥R',
                icon: <Copy size={14} />,
                onClick: () => copyToClipboard(getRawValue(item.value))
            },
            {
                label: 'Copy Key & Value',
                accessKey: 'B',
                shortcut: '⌥B',
                icon: <Copy size={14} />,
                onClick: () => {
                    const formattedValue = formatValueForClipboard(item.value);
                    copyToClipboard(`"${item.key}": ${formattedValue}`);
                }
            },
            filterKey && {
                label: `Copy All Isolated "${filterKey}" Values`,
                icon: <Copy size={14} />,
                onClick: copyAllIsolatedValues
            },
            { divider: true },
            {
                label: 'Copy JSON Path',
                accessKey: 'P',
                shortcut: '⌥P',
                icon: <Copy size={14} />,
                onClick: () => {
                    const path = item.path.filter(p => p !== 'root').join('.');
                    copyToClipboard(path || 'document');
                }
            },
            { divider: true },
            {
                label: filterKey ? 'Clear Property Isolation' : 'Property Isolation',
                shortcut: '⌥W',
                onClick: () => {
                    if (filterKey) {
                        setFilterKey(null);
                    } else {
                        setFilterKey(item.key);
                    }
                }
            },
            { divider: true },
            {
                label: 'Expand Level',
                shortcut: '⌥→',
                onClick: () => expandLevel(item)
            },
            {
                label: 'Collapse Level',
                shortcut: '⌥←',
                onClick: () => collapseLevel(item)
            },
            { divider: true },
            {
                label: 'Expand All',
                accessKey: 'E',
                onClick: () => expandAll(item)
            },
            {
                label: 'Collapse All',
                accessKey: 'C',
                onClick: () => collapseAll(item)
            },
            { divider: true },
            {
                label: 'Follow Link...',
                accessKey: 'F',
                shortcut: 'F',
                icon: <Link size={14} />,
                onClick: () => {
                    internalRef.current?.focus();
                    onFollowLink?.(item, true);
                }
            },
            item.type === 'primitive' && {
                label: 'Add Translation...',
                accessKey: 'T',
                icon: <Languages size={14} />,
                onClick: () => {
                    onAddTranslation?.(item);
                }
            }
        ].filter(Boolean) as ContextMenuItem[];
    };


    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (flattenedItems.length === 0) return;

        const currentIndex = flattenedItems.findIndex(item => item.id === focusedPath);
        let newIndex = currentIndex;

        if (e.altKey) {
            const item = flattenedItems[currentIndex];
            if (item) {
                if (e.code === 'KeyK') {
                    e.preventDefault();
                    copyToClipboard(item.key);
                    return;
                }
                if (e.code === 'KeyV') {
                    e.preventDefault();
                    copyToClipboard(formatValueForClipboard(item.value));
                    return;
                }
                if (e.code === 'KeyR') {
                    e.preventDefault();
                    copyToClipboard(getRawValue(item.value));
                    return;
                }
                if (e.code === 'KeyB') {
                    e.preventDefault();
                    const formattedValue = formatValueForClipboard(item.value);
                    copyToClipboard(`"${item.key}": ${formattedValue}`);
                    return;
                }
                if (e.code === 'KeyW') {
                    e.preventDefault();
                    if (filterKey) {
                        setFilterKey(null);
                    } else if (item) {
                        setFilterKey(item.key);
                    }
                    return;
                }
            } else if (e.code === 'KeyW' && filterKey) {
                // Global clear filter with Alt+W even if no item focused
                e.preventDefault();
                setFilterKey(null);
                return;
            }
        }

        switch (e.key) {
            case 'Escape': {
                if (filterKey) {
                    e.preventDefault();
                    setFilterKey(null);
                }
                break;
            }
            case 'ArrowDown':
            case 'j': {
                e.preventDefault();
                newIndex = Math.min(flattenedItems.length - 1, currentIndex + 1);
                break;
            }
            case 'ArrowUp':
            case 'k': {
                e.preventDefault();
                newIndex = Math.max(0, currentIndex - 1);
                break;
            }
            case 'ArrowRight':
            case 'l': {
                e.preventDefault();
                if (currentIndex === -1) return;
                const item = flattenedItems[currentIndex];
                if (item.hasChildren) {
                    if (e.altKey) {
                        expandLevel(item);
                    } else if (!item.expanded) {
                        const newKeys = new Set(expandedKeys);
                        newKeys.add(item.id);
                        setExpandedKeys(newKeys);
                    } else {
                        // Already expanded, move to next item (which will be the first child)
                        newIndex = Math.min(flattenedItems.length - 1, currentIndex + 1);
                    }
                }
                break;
            }
            case 'ArrowLeft':
            case 'h': {
                e.preventDefault();
                if (currentIndex === -1) return;
                const item = flattenedItems[currentIndex];
                if (e.altKey && item.hasChildren && item.expanded) {
                    collapseLevel(item);
                } else if (item.hasChildren && item.expanded) {
                    const newKeys = new Set(expandedKeys);
                    newKeys.delete(item.id);
                    setExpandedKeys(newKeys);
                } else {
                    // Move to parent
                    if (item.level > 0) {
                        // Find parent index
                        // Parent path is path sliced by -1
                        // Actually we can just search backwards for an item with level - 1
                        for (let i = currentIndex - 1; i >= 0; i--) {
                            if (flattenedItems[i].level < item.level) {
                                newIndex = i;
                                break;
                            }
                        }
                    }
                }
                break;
            }
            case 'Home': {
                e.preventDefault();
                newIndex = 0;
                break;
            }
            case 'End': {
                e.preventDefault();
                newIndex = flattenedItems.length - 1;
                break;
            }
            case 'Enter': {
                const item = flattenedItems[currentIndex];
                if (!item) break;

                if (e.altKey) {
                    e.preventDefault();
                    const el = document.getElementById(`json-node-${item.id}`);
                    showContextMenu(e, item, el || undefined);
                } else {
                    // Plain Enter - Follow Link
                    e.preventDefault();
                    onFollowLink?.(item);
                }
                break;
            }
            case 'f':
            case 'F': {
                if (e.metaKey || e.ctrlKey) break;
                const item = flattenedItems[currentIndex];
                if (item) {
                    e.preventDefault();
                    onFollowLink?.(item);
                }
                break;
            }
            case 'F10': {
                if (e.shiftKey) {
                    e.preventDefault();
                    const item = flattenedItems[currentIndex];
                    if (item) {
                        const el = document.getElementById(`json-node-${item.id}`);
                        showContextMenu(e, item, el || undefined);
                    }
                }
                break;
            }
        }

        if (newIndex !== currentIndex && newIndex !== -1) {
            setFocusedPath(flattenedItems[newIndex].id);

            // Auto-scroll
            const element = document.getElementById(`json-node-${flattenedItems[newIndex].id}`);
            element?.scrollIntoView({ block: 'nearest' });
        }
    };

    // Auto focus root on mount if nothing focused
    useEffect(() => {
        // maybe focus container?
    }, []);

    const toggleExpand = (id: string) => {
        const newKeys = new Set(expandedKeys);
        if (newKeys.has(id)) {
            newKeys.delete(id);
        } else {
            newKeys.add(id);
        }
        setExpandedKeys(newKeys);
    };

    return (
        <div
            className={`json-tree-view ${theme}`}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            ref={setBufferRef}
            onClick={() => internalRef.current?.focus()}
        >
            {filterKey && (
                <div className="filter-banner">
                    <span>Property Isolation: <strong>{filterKey}</strong></span>
                    <button className="clear-filter" onClick={(e) => { e.stopPropagation(); setFilterKey(null); }}>
                        Clear (Esc or Alt+W)
                    </button>
                </div>
            )}
            {flattenedItems.map((item: FlattenedItem) => (
                <JsonNode
                    key={item.id}
                    item={item}
                    isFocused={focusedPath === item.id}
                    onSelect={(id) => {
                        setFocusedPath(id);
                        internalRef.current?.focus();
                    }}
                    onToggle={toggleExpand}
                    onContextMenu={(e, i) => showContextMenu(e, i)}
                    onFollowLink={onFollowLink}
                    searchQuery={searchQuery}
                    searchIsRegex={searchIsRegex}
                    translations={translations}
                />
            ))}
            {contextMenu && contextMenu.visible && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={getContextMenuItems(contextMenu.data)}
                    onClose={closeContextMenu}
                />
            )}
        </div>
    );
});

JsonTreeView.displayName = 'JsonTreeView';

const JsonNode: React.FC<{
    item: FlattenedItem;
    isFocused: boolean;
    onSelect: (id: string) => void;
    onToggle: (id: string) => void;
    onContextMenu: (e: React.MouseEvent | React.KeyboardEvent, item: FlattenedItem) => void;
    onFollowLink?: (item: FlattenedItem, forceDialog?: boolean) => void;
    searchQuery?: string;
    searchIsRegex?: boolean;
    translations?: ContainerTranslations;
}> = ({ item, isFocused, onSelect, onToggle, onContextMenu, onFollowLink, searchQuery = '', searchIsRegex = false, translations = {} }) => {

    const renderTextWithHighlight = (text: string) => {
        if (!searchQuery) return text;

        try {
            let regex: RegExp;
            if (searchIsRegex) {
                regex = new RegExp(`(${searchQuery})`, 'gi');
            } else {
                // Escape special characters for plain text search
                const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                regex = new RegExp(`(${escaped})`, 'gi');
            }

            const parts = text.split(regex);
            return (
                <>
                    {parts.map((part, i) =>
                        regex.test(part) ? (
                            <span key={i} className="search-highlight">{part}</span>
                        ) : (
                            part
                        )
                    )}
                </>
            );
        } catch (err) {
            return text; // Fallback for invalid regex
        }
    };

    // Formatting value
    let valueDisplay = null;
    let typeClass = `type-${typeof item.value}`;

    if (item.value === null) {
        valueDisplay = <span className="json-null">null</span>;
    } else if (typeof item.value === 'boolean') {
        valueDisplay = <span className="json-boolean">{item.value.toString()}</span>;
    } else if (typeof item.value === 'number') {
        valueDisplay = <span className="json-number">{item.value}</span>;
    } else if (typeof item.value === 'string') {
        valueDisplay = (
            <span className={`json-string ${typeClass}`}>
                "{renderTextWithHighlight(item.value)}"
            </span>
        );
    } else if (Array.isArray(item.value)) {
        valueDisplay = <span className="json-array-label">Array({item.value.length})</span>;
    } else if (typeof item.value === 'object') {
        valueDisplay = <span className="json-object-label">{"{}"}</span>;
    }

    // Translation logic
    // Skip 'root' and any numeric path segments (array indices)
    const propertyPath = item.path.filter((p: any) => p !== 'root' && isNaN(Number(p))).join('.');
    const translation = translations[propertyPath]?.[String(item.value)];

    const translatedDisplay = translation ? (
        <span className="json-translation">
            ({translation})
        </span>
    ) : null;

    // Copy handlers
    const handleCopyKey = (e: React.MouseEvent) => {
        e.stopPropagation();
        copyToClipboard(item.key);
    };

    const handleCopyValue = (e: React.MouseEvent) => {
        e.stopPropagation();
        copyToClipboard(formatValueForClipboard(item.value));
    };

    const handleCopyRawValue = (e: React.MouseEvent) => {
        e.stopPropagation();
        copyToClipboard(getRawValue(item.value));
    };

    const handleCopyBoth = (e: React.MouseEvent) => {
        e.stopPropagation();
        const formattedValue = formatValueForClipboard(item.value);
        copyToClipboard(`"${item.key}": ${formattedValue}`);
    };

    return (
        <div
            id={`json-node-${item.id}`}
            className={`json-node ${isFocused ? 'focused' : ''} ${item.isLinkedData ? 'is-linked-data' : ''}`}
            style={{ paddingLeft: `${item.level * 20}px` }}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(item.id);
                if (item.hasChildren) {
                    onToggle(item.id);
                }
            }}
            onContextMenu={(e) => {
                onSelect(item.id);
                onContextMenu(e, item);
            }}
        >
            <span className="arrow">
                {item.hasChildren ? (item.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ display: 'inline-block', width: '1em' }}></span>}
            </span>
            <span className="json-key">
                {item.key === 'root' ? 'root' : renderTextWithHighlight(item.key)}
                {item.linkTarget && (
                    <span
                        className="json-link-indicator"
                        title={`Link leads to: ${item.linkTarget.targetDb} / ${item.linkTarget.targetContainer} (property: ${item.linkTarget.targetPropertyName})\nShortcut: F`}
                        onClick={(e) => { e.stopPropagation(); onSelect(item.id); onFollowLink?.(item); }}
                    >
                        <Link size={12} />
                    </span>
                )}:
            </span>
            {item.linkedValue !== undefined && (
                <span className="json-linked-original">
                    {typeof item.linkedValue === 'string' ? `"${item.linkedValue}"` : String(item.linkedValue)}
                </span>
            )}
            {valueDisplay}
            {translatedDisplay}
            <span className="copy-buttons">
                <button className="copy-btn" onClick={handleCopyKey} title="Copy key (Alt+K)">
                    <Copy size={10} /><span>K</span>
                </button>
                <button className="copy-btn" onClick={handleCopyValue} title="Copy value (Alt+V)">
                    <Copy size={10} /><span>V</span>
                </button>
                <button className="copy-btn" onClick={handleCopyRawValue} title="Copy raw value (Alt+R)">
                    <Copy size={10} /><span>R</span>
                </button>
                <button className="copy-btn" onClick={handleCopyBoth} title="Copy key & value (Alt+B)">
                    <Copy size={10} /><span>B</span>
                </button>
                <button
                    className={`copy-btn ${item.linkTarget ? 'follow-btn' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onSelect(item.id); onFollowLink?.(item); }}
                    title={item.linkTarget ? "Follow known link (F)" : "Open Follow Link dialogue (F)"}
                >
                    <Link size={10} /><span>F</span>
                </button>
            </span>
        </div>
    );
}

export default JsonTreeView;
