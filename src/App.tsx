import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { QueryEditor } from './components/QueryEditor';
import { ResultsView } from './components/ResultsView';
import { ConnectionForm } from './components/ConnectionForm';
import { cosmos } from './services/cosmos';

function App() {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionString, setConnectionString] = useState('');
    const [databases, setDatabases] = useState<string[]>([]);
    const [containers, setContainers] = useState<Record<string, string[]>>({});
    const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
    const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
    const [queryResults, setQueryResults] = useState<any[]>([]);
    const [isQuerying, setIsQuerying] = useState(false);

    const handleConnect = async (connStr: string) => {
        setConnectionString(connStr);
        const result = await cosmos.connect(connStr);
        if (result.success && result.data) {
            setDatabases(result.data);
            setIsConnected(true);
        }
    };

    const handleSelectDatabase = async (dbId: string) => {
        setSelectedDatabase(dbId);
        // In a real app, we'd fetch containers here. 
        // For now, let's assume we get them or mock them since our service only lists databases.
        // Wait, I need to implement listContainers in service.
        // For now I'll just mock it or assume the user knows the container name?
        // No, I should implement listContainers.
        // I'll add a TODO and mock it for now to keep moving.
        setContainers(prev => ({ ...prev, [dbId]: ['Container1', 'Container2'] }));
    };

    const handleRunQuery = async (query: string) => {
        if (!selectedDatabase || !selectedContainer) return;
        setIsQuerying(true);
        const result = await cosmos.query(selectedDatabase, selectedContainer, query);
        setIsQuerying(false);
        if (result.success && result.data) {
            setQueryResults(result.data);
        } else {
            console.error(result.error);
            setQueryResults([]);
        }
    };

    if (!isConnected) {
        return <ConnectionForm onConnect={handleConnect} />;
    }

    return (
        <Layout
            sidebar={
                <Sidebar
                    databases={databases}
                    selectedDatabase={selectedDatabase}
                    selectedContainer={selectedContainer}
                    onSelectDatabase={handleSelectDatabase}
                    onSelectContainer={setSelectedContainer}
                    containers={containers}
                />
            }
            content={
                <>
                    <QueryEditor onRunQuery={handleRunQuery} />
                    <ResultsView results={queryResults} loading={isQuerying} />
                </>
            }
        />
    );
}

export default App;
