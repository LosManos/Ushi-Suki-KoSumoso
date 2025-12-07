import React from 'react';
import './Layout.css';

interface LayoutProps {
    sidebar: React.ReactNode;
    content: React.ReactNode;
    sidebarWidth: number;
    onSidebarMouseDown: (e: React.MouseEvent) => void;
    sidebarResizeHandleRef: React.RefObject<HTMLDivElement>;
    isDraggingSidebar: boolean;
    onSidebarHandleKeyDown: (e: React.KeyboardEvent) => void;
}

export const Layout: React.FC<LayoutProps> = ({
    sidebar,
    content,
    sidebarWidth,
    onSidebarMouseDown,
    sidebarResizeHandleRef,
    isDraggingSidebar,
    onSidebarHandleKeyDown
}) => {
    return (
        <div className="app-layout">
            <aside className="sidebar" style={{ width: sidebarWidth }}>{sidebar}</aside>
            <div
                ref={sidebarResizeHandleRef}
                className={`resize-handle-vertical ${isDraggingSidebar ? 'dragging' : ''}`}
                onMouseDown={onSidebarMouseDown}
                tabIndex={0}
                title="Resize Sidebar (Ctrl+Shift+M)"
                onKeyDown={onSidebarHandleKeyDown}
            >
                <div className="resize-handle-vertical-grabber" />
            </div>
            <main className="main-content">{content}</main>
        </div>
    );
};
