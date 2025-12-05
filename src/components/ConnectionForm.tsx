import React, { useState } from 'react';
import { cosmos } from '../services/cosmos';
import './ConnectionForm.css';

interface ConnectionFormProps {
    onConnect: (connectionString: string) => void;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({ onConnect }) => {
    const [authMethod, setAuthMethod] = useState<'connectionString' | 'azureCli'>('connectionString');
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const result = await cosmos.connect(inputValue);
        setLoading(false);

        if (result.success) {
            onConnect(inputValue);
        } else {
            setError(result.error || 'Failed to connect');
        }
    };

    return (
        <div className="connection-form-container">
            <form onSubmit={handleSubmit} className="connection-form">
                <h2>Connect to Cosmos DB</h2>

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
