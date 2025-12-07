import React, { useState, useEffect } from 'react';
import { cosmos } from '../services/cosmos';
import './ConnectionForm.css';

interface ConnectionFormProps {
    onConnect: (connectionString: string) => void;
}

interface SavedConnection {
    name: string;
    connectionString: string;
    lastUsed: number;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({ onConnect }) => {
    const [authMethod, setAuthMethod] = useState<'connectionString' | 'azureCli'>('connectionString');
    const [inputValue, setInputValue] = useState('');
    const [connectionName, setConnectionName] = useState('');
    const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadSavedConnections();
        inputRef.current?.focus();
    }, []);

    const loadSavedConnections = async () => {
        const result = await cosmos.getConnections();
        if (result.success && result.data) {
            setSavedConnections(result.data);

            // Default to the most recently used connection if available
            if (result.data.length > 0) {
                const latest = result.data[0];
                setConnectionName(latest.name);
                setInputValue(latest.connectionString);
            }
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
                console.log('Attempting to save connection...');
                try {
                    // unexpected hangs can happen with native APIs, so we'll wrap this with a timeout
                    const savePromise = cosmos.saveConnection(connectionName.trim(), inputValue);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Save operation timed out')), 2000)
                    );

                    await Promise.race([savePromise, timeoutPromise]);
                    console.log('Connection saved successfully');
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
                <h2>Connect to Cosmos DB</h2>

                {savedConnections.length > 0 && (
                    <div className="form-group saved-connections-group">
                        <label>Saved Connections</label>
                        <select
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
                        Connection String
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
                        Azure CLI (az login)
                    </label>
                </div>

                {authMethod === 'connectionString' && (
                    <div className="form-group">
                        <label>Connection Name <small>(Optional - to remember for later)</small></label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
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
                        {authMethod === 'connectionString' ? 'Connection String' : 'Cosmos DB Endpoint URL'}
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
                <button type="submit" disabled={loading}>
                    {loading ? 'Connecting...' : 'Connect'}
                </button>
            </form>
        </div>
    );
};
