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

    const handleSelectDatabase = async (dbId: string | null) => {
        if (dbId === null) {
            setSelectedDatabase(null);
            return;
        }

        // Variable toggling is handled sidebar side or by passing logic, but user wants 'folding'.
        // If we select the SAME database, we might want to toggle? 
        // Logic will be driven by Sidebar, here we just respect the command.

        // If we switch database, we set it.
        if (selectedDatabase === dbId) {
            // Already selected, do nothing or let Sidebar handle 'collapse' by sending null
            return;
        }

        setSelectedDatabase(dbId);
        // Fetch real containers
        const result = await cosmos.getContainers(dbId);
        if (result.success && result.data) {
            setContainers(prev => ({ ...prev, [dbId]: result.data! }));
            // We DO NOT auto-select container anymore based on strict 'Enter only' rule?
            // Actually, if we just expand the DB, we shouldn't auto-select a container?
            // User said: "Only enter selects the collection".
            // So expanding DB should just show containers.
        } else {
            console.error('Failed to fetch containers:', result.error);
            setContainers(prev => ({ ...prev, [dbId]: [] }));
        }
    };

    const handleRunQuery = async (query: string, pageSize: number | 'All') => {
        console.log('App: HandleRunQuery called with pageSize:', pageSize);
        if (!selectedDatabase || !selectedContainer) {
            console.log('App: Not connected or no container selected');
            return;
        }
        setIsQuerying(true);
        console.log('App: Running query with pageSize:', pageSize);
        const result = await cosmos.query(selectedDatabase, selectedContainer, query, pageSize);
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
                    <QueryEditor
                        onRunQuery={handleRunQuery}
                        selectedContainer={selectedContainer}
                    />
                    <ResultsView results={queryResults} loading={isQuerying} />
                </>
            }
        />
    );
}

export default App;
