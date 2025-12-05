import React from 'react';
import './Layout.css';

interface LayoutProps {
    sidebar: React.ReactNode;
    content: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ sidebar, content }) => {
    return (
        <div className="app-layout">
            <aside className="sidebar">{sidebar}</aside>
            <main className="main-content">{content}</main>
        </div>
    );
};
