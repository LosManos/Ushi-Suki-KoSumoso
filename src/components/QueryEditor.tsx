import React, { useRef, useEffect, useState } from 'react';
import './QueryEditor.css';
import { QueryTab } from '../types';

interface QueryEditorProps {
    tabs: QueryTab[];
    activeTabId: string | null;
    onTabSelect: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    onRunQuery: (query: string, pageSize: number | 'All') => void;
    onGetDocument: (docId: string) => void;
    onQueryChange: (query: string) => void;
    onPageSizeChange: (pageSize: number | 'All') => void;
}

export const QueryEditor: React.FC<QueryEditorProps> = ({
    tabs,
    activeTabId,
    onTabSelect,
    onTabClose,
    onRunQuery,
    onGetDocument,
    onQueryChange,
    onPageSizeChange
}) => {
    const [quickId, setQuickId] = useState('');

    // Derived state from active tab
    const activeTab = tabs.find(t => t.id === activeTabId);
    const query = activeTab?.query || '';
    const pageSize = activeTab?.pageSize || 10;
    const selectedContainer = activeTab?.containerId || null;

    const pageSizeSelectRef = useRef<HTMLSelectElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const quickIdInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (activeTabId && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [activeTabId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + Enter to run query
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                onRunQuery(query, pageSize);
            }
            // Cmd/Ctrl + Shift + R to focus page size selector
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                pageSizeSelectRef.current?.focus();
            }
            // Cmd/Ctrl + Shift + I to focus ID lookup
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                quickIdInputRef.current?.focus();
            }
            // Cmd/Ctrl + 2 to focus query editor
            if ((e.metaKey || e.ctrlKey) && e.key === '2') {
                e.preventDefault();
                textareaRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [query, pageSize, onRunQuery]);

    const handleQuickLookup = () => {
        if (!quickId.trim()) return;
        onGetDocument(quickId.trim());
    };

    if (!activeTab) {
        return <div className="query-editor-container placeholder">Please select a container to start querying.</div>;
    }

    return (
        <div className="query-editor-container">
            <div className="editor-toolbar">
                <div className="tabs-container">
                    {tabs.map(tab => (
                        <span
                            key={tab.id}
                            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
                            onClick={() => onTabSelect(tab.id)}
                            title={`Query ${tab.containerId}`}
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
                    ))}
                </div>

                <div className="quick-lookup">
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
                    placeholder="SELECT * FROM c"
                />
            </div>
            <div className="editor-actions">
                <div className="page-size-selector">
                    <label title="Change page size (Cmd+Shift+R)">Results per page:</label>
                    <select
                        ref={pageSizeSelectRef}
                        value={pageSize}
                        onChange={(e) => {
                            const val = e.target.value;
                            onPageSizeChange(val === 'All' ? 'All' : Number(val));
                        }}
                        title="Change page size (Cmd+Shift+R)"
                    >
                        <option value={1}>1</option>
                        <option value={10}>10</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={1000}>1000</option>
                        <option value="All">All</option>
                    </select>
                </div>
                <button
                    className="run-btn"
                    onClick={() => onRunQuery(query, pageSize)}
                    title="Run Query (Cmd+Enter)"
                >
                    Run Query
                </button>
            </div>
        </div>
    );
};
