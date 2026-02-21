import React, { useEffect, useState, useRef } from 'react';
import { X, Calendar, ExternalLink, Loader2 } from 'lucide-react';
import './ChangelogDialog.css';

interface ChangelogItem {
    version: string;
    date: string;
    body: string;
    url: string;
}

interface ChangelogDialogProps {
    onClose: () => void;
}

export const ChangelogDialog: React.FC<ChangelogDialogProps> = ({ onClose }) => {
    const [releases, setReleases] = useState<ChangelogItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const awesomeBtnRef = useRef<HTMLButtonElement>(null);


    const openExternal = (url: string) => {
        window.ipcRenderer.invoke('app:openExternal', url);
    };

    useEffect(() => {
        const fetchReleases = async () => {
            try {
                const data = await window.ipcRenderer.invoke('app:getReleases');
                if (data.error) {
                    setError(data.error);
                } else {
                    setReleases(data);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to fetch releases');
            } finally {
                setIsLoading(false);
            }
        };

        fetchReleases();

        // Focus the scrollable body when the dialog opens
        // This allows immediate keyboard scrolling (arrows, PgUp/PgDn)
        const focusTimeout = setTimeout(() => {
            bodyRef.current?.focus();
        }, 100);

        return () => clearTimeout(focusTimeout);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Enter') {
                // If focus is on a button, let the button's click handler perform its action.
                // Otherwise, close the dialog.
                if (!(document.activeElement instanceof HTMLButtonElement)) {
                    onClose();
                }
            }

            // Alt+A for Awesome!
            // Using e.code for Mac compatibility as per rules.md
            if (e.altKey && e.code === 'KeyA') {
                e.preventDefault();
                onClose();
            }

            // Alt+G for first GitHub link
            if (e.altKey && e.code === 'KeyG') {
                e.preventDefault();
                const latestRelease = releases[0];
                if (latestRelease) {
                    openExternal(latestRelease.url);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, releases]);

    const parseHighlights = (body: string, version: string) => {
        if (!body || body.trim() === '') return [version];

        // Split by lines and filter out empty ones, keeping the original text as is
        const lines = body.split('\n').map(l => l.trim()).filter(l => l);

        // Just return the raw lines
        return lines.length > 0 ? lines : [version];
    };



    const renderTextWithLinks = (text: string) => {
        // More robust URL regex that handles trailing punctuation better
        const urlRegex = /(https?:\/\/[^\s]+?)(?=[.,;)]?(?:\s|$))/g;
        const parts = text.split(urlRegex);

        return parts.map((part, i) => {
            if (part && part.startsWith('http')) {
                return (
                    <button
                        key={i}
                        className="inline-link-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            openExternal(part);
                        }}
                        title={part}
                    >
                        {part.length > 40 ? part.substring(0, 40) + '...' : part}
                        <ExternalLink size={10} style={{ marginLeft: '2px' }} />
                    </button>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="changelog-dialog" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
                <div className="dialog-header">
                    <div className="title-wrapper">
                        <h3>Changelog</h3>
                    </div>
                    <button className="close-btn" onClick={onClose} title="Close (Esc)">
                        <X size={18} />
                    </button>
                </div>
                <div
                    ref={bodyRef}
                    className="dialog-body"
                    tabIndex={0}
                    style={{ outline: 'none' }}
                >
                    {isLoading ? (
                        <div className="changelog-loading">
                            <Loader2 size={32} className="spin-icon" />
                            <p>Fetching the latest updates...</p>
                        </div>
                    ) : error ? (
                        <div className="changelog-error">
                            <p>Failed to load changelog: {error}</p>
                            <button className="secondary-btn" onClick={onClose}>Close</button>
                        </div>
                    ) : (
                        <div className="changelog-container">
                            {releases.map((item, index) => (
                                <div key={item.version} className="changelog-item">
                                    <div className="changelog-sidebar">
                                        <div className="version-badge">v{item.version}</div>
                                        <div className="date-wrapper">
                                            <Calendar size={12} />
                                            <span>{item.date}</span>
                                        </div>
                                        {index === 0 && <div className="latest-label">Latest</div>}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openExternal(item.url);
                                            }}
                                            className="view-on-github-btn"
                                            title={index === 0 ? "View on GitHub (Alt+G)" : "View on GitHub"}
                                        >
                                            {index === 0 ? <u>G</u> : 'G'}itHub <ExternalLink size={10} />
                                        </button>
                                    </div>
                                    <div className="changelog-content">
                                        <ul>
                                            {parseHighlights(item.body, `v${item.version}`).map((highlight, hIndex) => (
                                                <li key={hIndex}>
                                                    <span className="list-bullet">&bull;</span>
                                                    <span>{renderTextWithLinks(highlight)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="dialog-footer">
                    <button
                        ref={awesomeBtnRef}
                        className="primary-btn"
                        onClick={onClose}
                        title="Close this dialog (Alt+A or Enter)"
                    >
                        <u>A</u>wesome!
                    </button>
                </div>
            </div>
        </div>
    );
};
