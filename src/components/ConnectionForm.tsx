import React, { useState } from 'react';
import { cosmos } from '../services/cosmos';
import './ConnectionForm.css';

interface ConnectionFormProps {
    onConnect: (connectionString: string) => void;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({ onConnect }) => {
    const [connectionString, setConnectionString] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const result = await cosmos.connect(connectionString);
        setLoading(false);

        if (result.success) {
            onConnect(connectionString);
        } else {
            setError(result.error || 'Failed to connect');
        }
    };

    return (
        <div className="connection-form-container">
            <form onSubmit={handleSubmit} className="connection-form">
                <h2>Connect to Cosmos DB</h2>
                <div className="form-group">
                    <label>Connection String</label>
                    <input
                        type="password"
                        value={connectionString}
                        onChange={(e) => setConnectionString(e.target.value)}
                        placeholder="AccountEndpoint=...;AccountKey=..."
                        required
                    />
                </div>
                {error && <div className="error-message">{error}</div>}
                <button type="submit" disabled={loading}>
                    {loading ? 'Connecting...' : 'Connect'}
                </button>
            </form>
        </div>
    );
};
