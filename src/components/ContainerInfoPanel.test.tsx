// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContainerInfoPanel } from './ContainerInfoPanel';
import { cosmos } from '../services/cosmos';

// Mock the cosmos service calls
vi.mock('../services/cosmos', () => ({
    cosmos: {
        getContainerInfo: vi.fn(),
        getContainerKeys: vi.fn()
    }
}));

describe('ContainerInfoPanel', () => {
    const defaultProps = {
        databaseId: 'test-db',
        containerId: 'test-container',
        isOpen: true,
        onClose: vi.fn()
    };

    const mockInfoResponse = {
        success: true,
        data: {
            partitionKeyPaths: ['/id'],
            partitionKeyVersion: 2,
            indexingPolicy: {
                indexingMode: 'consistent',
                includedPaths: ['/*'],
                excludedPaths: ['/\"_etag\"/?']
            },
            defaultTtl: -1,
            _ts: 1678886400 // mock timestamp
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(cosmos.getContainerInfo).mockResolvedValue(mockInfoResponse);
        vi.mocked(cosmos.getContainerKeys).mockResolvedValue({ success: true, data: ['id', 'name', 'createdAt'] });
    });

    it('renders null when not open', () => {
        const { baseElement } = render(<ContainerInfoPanel {...defaultProps} isOpen={false} />);
        expect(baseElement.querySelector('.container-info-panel')).not.toBeInTheDocument();
    });

    it('fetches and displays container info when opened', async () => {
        const { baseElement } = render(<ContainerInfoPanel {...defaultProps} />);
        
        // Wait for it to load
        await waitFor(() => {
            expect(cosmos.getContainerInfo).toHaveBeenCalledWith('test-db', 'test-container');
        });

        // Ensure portal was created in body
        expect(baseElement.querySelector('.container-info-panel')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('test-db')).toBeInTheDocument();
            expect(screen.getByText('test-container')).toBeInTheDocument();
            expect(screen.getByText('/id')).toBeInTheDocument();
            expect(screen.getByText('consistent')).toBeInTheDocument();
        });
    });

    it('handles discover schema', async () => {
        render(<ContainerInfoPanel {...defaultProps} />);
        
        await waitFor(() => {
            expect(screen.getByText('test-container')).toBeInTheDocument();
        });
        
        const discoverBtn = screen.getByRole('button', { name: /Discover/i });
        fireEvent.click(discoverBtn);

        await waitFor(() => {
            expect(cosmos.getContainerKeys).toHaveBeenCalledWith('test-db', 'test-container', 10);
            expect(screen.getByText('name')).toBeInTheDocument();
            expect(screen.getByText('createdAt')).toBeInTheDocument();
        });

        // Search in schema
        const searchInput = screen.getByPlaceholderText(/Search property names/i);
        fireEvent.change(searchInput, { target: { value: 'cre' } });
        
        expect(screen.getByText('createdAt')).toBeInTheDocument();
        expect(screen.queryByText('name')).not.toBeInTheDocument();
    });

    it('closes on escape key or close button', async () => {
        render(<ContainerInfoPanel {...defaultProps} />);
        
        await waitFor(() => {
            expect(screen.getByText('test-container')).toBeInTheDocument();
        });

        const closeBtn = screen.getByTitle('Close (Esc)');
        fireEvent.click(closeBtn);
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
    });
});
