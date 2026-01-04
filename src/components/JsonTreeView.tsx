import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronRight, ChevronDown, Copy, Link } from 'lucide-react';
import { useContextMenu } from '../hooks/useContextMenu';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { LinkMapping } from '../services/linkService';
import './JsonTreeView.css';

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

interface JsonTreeViewProps {
    data: any;
    theme?: 'light' | 'dark';
    onFollowLink?: (item: FlattenedItem, forceDialog?: boolean) => void;
    storedLinks?: Record<string, any>;
    accountName?: string;
    activeTabId?: string;
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
}

// Interface removed as we forward HTMLDivElement directly

export const JsonTreeView = React.forwardRef<HTMLDivElement, JsonTreeViewProps>(({ data, theme = 'dark', onFollowLink, storedLinks = {}, accountName = '', activeTabId = '' }, ref) => {
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(['root']));
    const [focusedPath, setFocusedPath] = useState<string>('root');
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

    const getContextMenuItems = (item: FlattenedItem): ContextMenuItem[] => {
        return [
            {
                label: 'Copy Key',
                accessKey: 'K',
                icon: <Copy size={14} />,
                onClick: () => copyToClipboard(item.key)
            },
            {
                label: 'Copy Value',
                accessKey: 'V',
                icon: <Copy size={14} />,
                onClick: () => copyToClipboard(formatValueForClipboard(item.value))
            },
            {
                label: 'Copy Raw Value',
                accessKey: 'R',
                icon: <Copy size={14} />,
                onClick: () => copyToClipboard(getRawValue(item.value))
            },
            {
                label: 'Copy Key & Value',
                accessKey: 'B',
                icon: <Copy size={14} />,
                onClick: () => {
                    const formattedValue = formatValueForClipboard(item.value);
                    copyToClipboard(`"${item.key}": ${formattedValue}`);
                }
            },
            { divider: true },
            {
                label: 'Copy JSON Path',
                accessKey: 'P',
                icon: <Copy size={14} />,
                onClick: () => {
                    const path = item.path.filter(p => p !== 'root').join('.');
                    copyToClipboard(path || 'document');
                }
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
                onClick: () => {
                    internalRef.current?.focus();
                    onFollowLink?.(item, true);
                }
            }
        ];
    };

    // Flatten the visible tree structure
    const flattenedItems = useMemo(() => {
        const items: FlattenedItem[] = [];

        const traverse = (currentData: any, currentLevel: number, currentPath: string[]) => {
            const pathStr = currentPath.join('.');

            // Determine type
            let type: 'object' | 'array' | 'primitive' = 'primitive';
            let hasChildren = false;
            let displayData = currentData;
            let linkedValue = undefined;

            // Handle wrapped linked values
            if (currentData !== null && typeof currentData === 'object' && currentData.__isLinked__) {
                displayData = currentData.linkedData;
                linkedValue = currentData.originalValue;
            }

            if (displayData !== null && typeof displayData === 'object') {
                type = Array.isArray(displayData) ? 'array' : 'object';
                hasChildren = Object.keys(displayData).length > 0;
            }

            // We don't push the root object itself as a visible line if we want to show its properties directly?
            // Actually, usually root is implicit. Let's make root renderable so we can collapse it if we want, 
            // or better, just start traversing from root properties if root is an array/object.
            // But typically JSON view starts with { or [

            const isExpanded = expandedKeys.has(pathStr);

            // However, for the list logic, we need items.
            // Let's treat the incoming 'data' as the root item.
            if (currentPath.length === 0) {
                // Special case for root
                const rootType = Array.isArray(data) ? 'array' : (typeof data === 'object' && data !== null ? 'object' : 'primitive');
                const rootHasChildren = rootType !== 'primitive' && Object.keys(data).length > 0;
                items.push({
                    id: 'root',
                    key: 'root',
                    value: data,
                    level: 0,
                    type: rootType,
                    expanded: expandedKeys.has('root'),
                    hasChildren: rootHasChildren,
                    path: ['root']
                });

                if (expandedKeys.has('root') && rootHasChildren) {
                    Object.entries(data).forEach(([k, v]) => {
                        traverse(v, 1, ['root', k]);
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
                linkedValue
            });

            if (isExpanded && hasChildren) {
                Object.entries(displayData).forEach(([k, v]) => {
                    traverse(v, currentLevel + 1, [...currentPath, k]);
                });
            }
        };

        // Initialize with data
        traverse(data, 0, []);

        // Post-process to mark isLinked based on storedLinks
        if (Object.keys(storedLinks).length > 0 && accountName && activeTabId) {
            items.forEach(item => {
                // Same logic as in App.tsx for sourceKey
                const propertyPath = item.path.filter((p: any) => p !== 'root' && typeof p !== 'number').join('.');
                if (!propertyPath) return;
                const sourceKey = `${accountName}/${activeTabId}:${propertyPath}`;
                const mapping = storedLinks[sourceKey];
                if (mapping) {
                    item.linkTarget = mapping;
                }
            });
        }

        return items;
    }, [data, expandedKeys, storedLinks, accountName, activeTabId]);


    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (flattenedItems.length === 0) return;

        const currentIndex = flattenedItems.findIndex(item => item.id === focusedPath);
        let newIndex = currentIndex;

        switch (e.key) {
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
                    if (!item.expanded) {
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
                if (item.hasChildren && item.expanded) {
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
            case 'f':
            case 'F': {
                const item = flattenedItems[currentIndex];
                if (item) {
                    e.preventDefault();
                    onFollowLink?.(item);
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
}> = ({ item, isFocused, onSelect, onToggle, onContextMenu, onFollowLink }) => {

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
        valueDisplay = <span className={`json-string ${typeClass}`}>"{item.value}"</span>;
    } else if (Array.isArray(item.value)) {
        valueDisplay = <span className="json-array-label">Array({item.value.length})</span>;
    } else if (typeof item.value === 'object') {
        valueDisplay = <span className="json-object-label">{"{}"}</span>;
    }

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
            className={`json-node ${isFocused ? 'focused' : ''}`}
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
                {item.key === 'root' ? 'root' : item.key}
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
            <span className="copy-buttons">
                <button className="copy-btn" onClick={handleCopyKey} title="Copy key">
                    <Copy size={10} /><span>K</span>
                </button>
                <button className="copy-btn" onClick={handleCopyValue} title="Copy value (with quotes)">
                    <Copy size={10} /><span>V</span>
                </button>
                <button className="copy-btn" onClick={handleCopyRawValue} title="Copy raw value (no quotes)">
                    <Copy size={10} /><span>R</span>
                </button>
                <button className="copy-btn" onClick={handleCopyBoth} title="Copy key & value">
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
