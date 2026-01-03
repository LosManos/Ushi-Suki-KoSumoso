import { useState, useCallback } from 'react';

export interface ContextMenuState {
    x: number;
    y: number;
    visible: boolean;
    data?: any;
}

export const useContextMenu = () => {
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    const showContextMenu = useCallback((e: React.MouseEvent | React.KeyboardEvent | MouseEvent, data?: any, anchorEl?: HTMLElement) => {
        // Prevent default browser context menu
        if ('preventDefault' in e) {
            e.preventDefault();
        }

        // Stop propagation to prevent multiple triggers
        if ('stopPropagation' in e) {
            e.stopPropagation();
        }

        let x = 0;
        let y = 0;

        if ('clientX' in e) {
            // Mouse event
            x = (e as React.MouseEvent).clientX;
            y = (e as React.MouseEvent).clientY;
        } else {
            // Keyboard event (Shift+F10 or Alt+Enter)
            const target = anchorEl || (e.target as HTMLElement);
            const rect = target.getBoundingClientRect();
            // Position it relative to the target element
            x = rect.left + (rect.width / 2);
            y = rect.top + (rect.height / 2);
        }

        setContextMenu({ x, y, visible: true, data });
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    return {
        contextMenu,
        showContextMenu,
        closeContextMenu
    };
};
