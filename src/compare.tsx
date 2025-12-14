import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { CompareView } from './components/CompareView';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

// Wrapper component to fetch documents via IPC
const CompareApp: React.FC = () => {
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDocuments = async () => {
            try {
                console.log('[Compare] Fetching documents via IPC...');
                const docs = await (window as any).ipcRenderer.invoke('compare:getDocuments');
                console.log('[Compare] Received', docs?.length || 0, 'documents');
                setDocuments(docs || []);
            } catch (e: any) {
                console.error('[Compare] Failed to fetch documents:', e);
                setError(e.message || 'Failed to load documents');
            } finally {
                setLoading(false);
            }
        };

        fetchDocuments();
    }, []);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                color: 'var(--text-secondary)'
            }}>
                Loading documents...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                color: '#ef4444'
            }}>
                Error: {error}
            </div>
        );
    }

    if (documents.length === 0) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                color: 'var(--text-secondary)'
            }}>
                No documents to compare
            </div>
        );
    }

    return <CompareView documents={documents} />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider>
            <CompareApp />
        </ThemeProvider>
    </React.StrictMode>,
);
