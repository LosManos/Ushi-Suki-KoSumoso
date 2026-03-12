// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionForm } from './ConnectionForm';
import { cosmos } from '../services/cosmos';
import React from 'react';

// Mock Cosmos service
vi.mock('../services/cosmos', () => ({
    cosmos: {
        getConnections: vi.fn(),
        connect: vi.fn(),
        saveConnection: vi.fn(),
        deleteConnection: vi.fn()
    }
}));

// Mock ipcRenderer
const mockInvoke = vi.fn();
(window as any).ipcRenderer = {
    invoke: mockInvoke
};

describe('ConnectionForm', () => {
    const mockOnConnect = vi.fn();
    const mockOnCancel = vi.fn();
    const mockOnShowChangelog = vi.fn();

    const mockSavedConnections = [
        { name: 'Prod DB', connectionString: 'AccountEndpoint=https://prod;AccountKey=abc', lastUsed: 2000 },
        { name: 'Test DB', connectionString: 'AccountEndpoint=https://test;AccountKey=xyz', lastUsed: 1000 }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockInvoke.mockReset();
        mockInvoke.mockResolvedValue('1.2.3'); // app:getVersion

        // Default cosmos mock returns
        vi.mocked(cosmos.getConnections).mockResolvedValue({ success: true, data: mockSavedConnections });
        vi.mocked(cosmos.connect).mockResolvedValue({ success: true, data: {} as any });
        vi.mocked(cosmos.saveConnection).mockResolvedValue({ success: true });
    });

    it('renders with app version and update badge if available', async () => {
        const updateInfo = { isNewer: true, latestVersion: '1.3.0', url: 'https://example.com' };
        render(<ConnectionForm onConnect={mockOnConnect} updateInfo={updateInfo} onShowChangelog={mockOnShowChangelog} />);

        await waitFor(() => {
            expect(screen.getByText('v1.2.3')).toBeInTheDocument();
        });

        expect(screen.getByText(/v1\.3\.0 available!/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Changelog\.\.\./i })).toBeInTheDocument();
    });

    it('loads and selects the most recent saved connection', async () => {
        render(<ConnectionForm onConnect={mockOnConnect} />);

        await waitFor(() => {
            expect(cosmos.getConnections).toHaveBeenCalledOnce();
        });

        // The 'Connection Name' input should be populated
        const nameInput = screen.getByLabelText(/Connection Name/i) as HTMLInputElement;
        expect(nameInput.value).toBe('Prod DB');

        // The connection string input should be populated
        const stringInput = screen.getByPlaceholderText(/AccountEndpoint/i) as HTMLInputElement;
        expect(stringInput.value).toBe('AccountEndpoint=https://prod;AccountKey=abc');
    });

    it('submits connection string successfully', async () => {
        render(<ConnectionForm onConnect={mockOnConnect} />);

        await waitFor(() => {
            expect(cosmos.getConnections).toHaveBeenCalledOnce();
        });

        const connectBtn = screen.getByRole('button', { name: /^Connect$/i });
        fireEvent.click(connectBtn);

        await waitFor(() => {
            expect(cosmos.connect).toHaveBeenCalledWith('AccountEndpoint=https://prod;AccountKey=abc');
            expect(cosmos.saveConnection).toHaveBeenCalledWith('Prod DB', 'AccountEndpoint=https://prod;AccountKey=abc');
            expect(mockOnConnect).toHaveBeenCalledWith('AccountEndpoint=https://prod;AccountKey=abc');
        });
    });

    it('shows error if connection fails', async () => {
        vi.mocked(cosmos.connect).mockResolvedValueOnce({ success: false, error: 'Invalid config' });
        
        render(<ConnectionForm onConnect={mockOnConnect} />);

        await waitFor(() => {
            expect(cosmos.getConnections).toHaveBeenCalledOnce();
        });

        const connectBtn = screen.getByRole('button', { name: /^Connect$/i });
        fireEvent.click(connectBtn);

        await waitFor(() => {
            expect(screen.getByText('Invalid config')).toBeInTheDocument();
            expect(mockOnConnect).not.toHaveBeenCalled();
        });
    });

    it('switches auth methods correctly', async () => {
        render(<ConnectionForm onConnect={mockOnConnect} />);

        await waitFor(() => {
            expect(cosmos.getConnections).toHaveBeenCalledOnce();
        });

        const azureCliRb = screen.getByLabelText(/Azure CLI/i);
        fireEvent.click(azureCliRb);

        // Name input should disappear
        expect(screen.queryByLabelText(/Connection Name/i)).not.toBeInTheDocument();

        // Label should change
        expect(screen.getByLabelText(/Cosmos DB Endpoint URL/i)).toBeInTheDocument();
        
        // Input should be empty
        const endpointInput = screen.getByLabelText(/Cosmos DB Endpoint URL/i) as HTMLInputElement;
        expect(endpointInput.value).toBe('');
        expect(endpointInput.type).toBe('url');
    });
});
