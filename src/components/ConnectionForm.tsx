import React, { useState, useEffect } from 'react';
import { cosmos } from '../services/cosmos';
import './ConnectionForm.css';

interface ConnectionFormProps {
    onConnect: (connectionString: string) => void;
    onCancel?: () => void;
    onShowChangelog?: () => void;
    updateInfo?: { isNewer: boolean; latestVersion: string; url: string } | null;
}

interface SavedConnection {
    name: string;
    connectionString: string;
    lastUsed: number;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({ onConnect, onCancel, onShowChangelog, updateInfo }) => {
    const [authMethod, setAuthMethod] = useState<'connectionString' | 'azureCli'>('connectionString');
    const [inputValue, setInputValue] = useState('');
    const [connectionName, setConnectionName] = useState('');
    const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [appVersion, setAppVersion] = useState<string>('');

    useEffect(() => {
        window.ipcRenderer.invoke('app:getVersion').then(v => setAppVersion(v));
    }, []);

    const inputRef = React.useRef<HTMLInputElement>(null);

    const savedSelectRef = React.useRef<HTMLSelectElement>(null);
    const nameInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadSavedConnections();
    }, []);

    // Handle ESC key to cancel
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && onCancel) {
                onCancel();
                return;
            }

            // Custom shortcuts (Windows-style Alt keys)
            // On Mac, Alt (Option) often produces special characters in e.key (e.g. ß for s),
            // so we must use e.code (e.g. KeyS) to reliably detect the intended key.
            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                switch (e.code) {
                    case 'KeyS': {
                        e.preventDefault();
                        savedSelectRef.current?.focus();
                        break;
                    }
                    case 'KeyN': {
                        e.preventDefault();
                        nameInputRef.current?.focus();
                        break;
                    }
                    case 'KeyO': {
                        e.preventDefault();
                        setAuthMethod('connectionString');
                        setInputValue('');
                        break;
                    }
                    case 'KeyA': {
                        e.preventDefault();
                        setAuthMethod('azureCli');
                        setInputValue('');
                        break;
                    }
                    case 'KeyC': {
                        e.preventDefault();
                        inputRef.current?.focus();
                        break;
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCancel]);


    const loadSavedConnections = async () => {
        const result = await cosmos.getConnections();
        if (result.success && result.data) {
            setSavedConnections(result.data);

            // Default to the most recently used connection if available
            if (result.data.length > 0) {
                const latest = result.data[0];
                setConnectionName(latest.name);
                setInputValue(latest.connectionString);

                // Focus the saved connections dropdown
                setTimeout(() => savedSelectRef.current?.focus(), 0);
            } else {
                // No saved connections - focus the connection name input
                setTimeout(() => nameInputRef.current?.focus(), 0);
            }
        } else {
            // Failed to load or no data - focus the connection name input
            setTimeout(() => nameInputRef.current?.focus(), 0);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const result = await cosmos.connect(inputValue);

        if (result.success) {
            // Save if using connection string and name is provided
            if (authMethod === 'connectionString' && connectionName.trim()) {
                try {
                    // unexpected hangs can happen with native APIs, so we'll wrap this with a timeout
                    const savePromise = cosmos.saveConnection(connectionName.trim(), inputValue);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Save operation timed out')), 2000)
                    );

                    await Promise.race([savePromise, timeoutPromise]);
                } catch (saveError) {
                    console.warn('Failed to save connection or timed out (proceeding with login):', saveError);
                    // We knowingly proceed to onConnect even if save fails
                }
            }
            onConnect(inputValue);
        } else {
            setError(result.error || 'Failed to connect');
            setLoading(false);
        }
    };

    const handleSavedConnectionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedName = e.target.value;
        if (!selectedName) return;

        const conn = savedConnections.find(c => c.name === selectedName);
        if (conn) {
            setConnectionName(conn.name);
            setInputValue(conn.connectionString);
            setAuthMethod('connectionString');
        }
    };

    const handleDeleteConnection = async () => {
        if (!connectionName || !savedConnections.find(c => c.name === connectionName)) return;

        if (confirm(`Are you sure you want to delete the saved connection "${connectionName}"?`)) {
            await cosmos.deleteConnection(connectionName);
            setConnectionName('');
            setInputValue('');
            loadSavedConnections();
        }
    };

    return (
        <div className="connection-form-container">
            <form onSubmit={handleSubmit} className="connection-form">
                <div className="logo-container">
                    <img src="v_ios.png" alt="Kosumoso Logo" className="app-logo" />
                </div>
                <div className="title-container">
                    <h2>Kosumoso</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="app-version">v{appVersion}</span>
                        {updateInfo?.isNewer && (
                            <a
                                href={updateInfo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="update-available-link"
                                title={`Version v${updateInfo.latestVersion} is available. Click to download.`}
                            >
                                ✨ v{updateInfo.latestVersion} available!
                            </a>
                        )}
                        {onShowChangelog && (
                            <button
                                type="button"
                                className="changelog-badge-btn"
                                onClick={onShowChangelog}
                                title="Changelog..."
                            >
                                Changelog...
                            </button>
                        )}
                    </div>
                </div>

                {savedConnections.length > 0 && (
                    <div className="form-group saved-connections-group">
                        <label><u>S</u>aved Connections</label>
                        <select
                            ref={savedSelectRef}
                            onChange={handleSavedConnectionSelect}
                            value={savedConnections.find(c => c.name === connectionName) ? connectionName : ''}
                        >
                            <option value="">-- Select a saved connection --</option>
                            {savedConnections.map(c => (
                                <option key={c.name} value={c.name}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="auth-method-toggle">
                    <label>
                        <input
                            type="radio"
                            checked={authMethod === 'connectionString'}
                            onChange={() => {
                                setAuthMethod('connectionString');
                                setInputValue('');
                            }}
                        />
                        <span>C<u>o</u>nnection String</span>
                    </label>
                    <label>
                        <input
                            type="radio"
                            checked={authMethod === 'azureCli'}
                            onChange={() => {
                                setAuthMethod('azureCli');
                                setInputValue('');
                            }}
                        />
                        <span><u>A</u>zure CLI (az login)</span>
                    </label>
                </div>

                {authMethod === 'connectionString' && (
                    <div className="form-group">
                        <label>Connection <u>N</u>ame <small>(Optional - to remember for later)</small></label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={connectionName}
                                onChange={(e) => setConnectionName(e.target.value)}
                                placeholder="My Production DB"
                                style={{ flex: 1 }}
                            />
                            {savedConnections.find(c => c.name === connectionName) && (
                                <button
                                    type="button"
                                    className="delete-btn"
                                    onClick={handleDeleteConnection}
                                    title="Delete saved connection"
                                >
                                    🗑️
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="form-group">
                    <label>
                        {authMethod === 'connectionString' ? <><u>C</u>onnection String</> : <><u>C</u>osmos DB Endpoint URL</>}
                    </label>
                    <input
                        ref={inputRef}
                        type={authMethod === 'connectionString' ? 'password' : 'url'}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={
                            authMethod === 'connectionString'
                                ? "AccountEndpoint=...;AccountKey=..."
                                : "https://<my-account>.documents.azure.com:443/"
                        }
                        required
                        autoFocus
                    />
                    {authMethod === 'azureCli' && (
                        <small className="help-text">
                            Make sure you have run <code>az login</code> in your terminal.
                        </small>
                    )}
                </div>
                {error && <div className="error-message">{error}</div>}

                <div className="form-actions">
                    {onCancel && (
                        <button type="button" className="cancel-btn" onClick={onCancel}>
                            Cancel
                        </button>
                    )}
                    <button type="submit" disabled={loading} className="connect-btn">
                        {loading ? 'Connecting...' : 'Connect'}
                    </button>
                </div>
            </form>
        </div>
    );
};
