import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import './ContextMenu.css';

export interface ContextMenuItem {
    label?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
    divider?: boolean;
    accessKey?: string;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [adjustedPos, setAdjustedPos] = useState({ x, y });
    const [focusedIndex, setFocusedIndex] = useState(0);

    // Filter only items that are not dividers
    const navigableItems = items.filter(item => item.label);

    useEffect(() => {
        // Store the element that had focus before the menu opened
        const previouslyFocusedElement = document.activeElement as HTMLElement;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            // Restore focus when the menu is unmounted/closed
            if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
                previouslyFocusedElement.focus();
            }
        };
    }, [onClose]);

    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            let newX = x;
            let newY = y;

            if (x + rect.width > screenWidth) {
                newX = screenWidth - rect.width - 5;
            }
            if (y + rect.height > screenHeight) {
                newY = screenHeight - rect.height - 5;
            }

            setAdjustedPos({ x: newX, y: newY });

            // Focus the first item when menu opens
            itemRefs.current[0]?.focus();
        }
    }, [x, y]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        switch (e.key) {
            case 'ArrowDown': {
                const nextIndex = (focusedIndex + 1) % navigableItems.length;
                setFocusedIndex(nextIndex);
                itemRefs.current[nextIndex]?.focus();
                break;
            }
            case 'ArrowUp': {
                const prevIndex = (focusedIndex - 1 + navigableItems.length) % navigableItems.length;
                setFocusedIndex(prevIndex);
                itemRefs.current[prevIndex]?.focus();
                break;
            }
            case 'Enter':
            case ' ': {
                const item = navigableItems[focusedIndex];
                if (item) {
                    item.onClick?.();
                    onClose();
                }
                break;
            }
            case 'Escape': {
                onClose();
                break;
            }
            case 'Tab': {
                // Keep focus inside the menu
                const direction = e.shiftKey ? -1 : 1;
                const nextIndex = (focusedIndex + direction + navigableItems.length) % navigableItems.length;
                setFocusedIndex(nextIndex);
                itemRefs.current[nextIndex]?.focus();
                break;
            }
            default: {
                // Support access keys (hotkeys)
                const key = e.key.toLowerCase();
                if (key.length === 1) { // Normal character
                    const matchIndex = items.findIndex(item => item.accessKey?.toLowerCase() === key);
                    if (matchIndex !== -1) {
                        const item = items[matchIndex];
                        item.onClick?.();
                        onClose();
                    }
                }
                break;
            }
        }
    };

    const renderLabel = (label: string, accessKey?: string) => {
        if (!accessKey) return label;

        const keyIndex = label.toLowerCase().indexOf(accessKey.toLowerCase());
        if (keyIndex === -1) return `${label} (${accessKey.toUpperCase()})`;

        return (
            <>
                {label.substring(0, keyIndex)}
                <span className="access-key">{label.substring(keyIndex, keyIndex + 1)}</span>
                {label.substring(keyIndex + 1)}
            </>
        );
    };

    let navigableItemCounter = 0;

    return ReactDOM.createPortal(
        <div
            ref={menuRef}
            className="context-menu"
            style={{
                top: adjustedPos.y,
                left: adjustedPos.x,
                visibility: adjustedPos.x === 0 && adjustedPos.y === 0 ? 'hidden' : 'visible'
            }}
            onKeyDown={handleKeyDown}
            role="menu"
        >
            {items.map((item, index) => {
                if (item.divider) {
                    return <div key={`div-${index}`} className="context-menu-divider" />;
                }

                if (item.label) {
                    const currentNavIndex = navigableItemCounter++;
                    return (
                        <div
                            key={`item-${index}`}
                            ref={el => itemRefs.current[currentNavIndex] = el}
                            className={`context-menu-item ${focusedIndex === currentNavIndex ? 'focused' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                item.onClick?.();
                                onClose();
                            }}
                            onMouseEnter={() => setFocusedIndex(currentNavIndex)}
                            tabIndex={0}
                            role="menuitem"
                        >
                            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                            <span className="context-menu-label">{renderLabel(item.label, item.accessKey)}</span>
                        </div>
                    );
                }

                return null;
            })}
        </div>,
        document.body
    );
};
