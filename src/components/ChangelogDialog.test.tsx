// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChangelogDialog } from './ChangelogDialog';
import React from 'react';

// Mock ipcRenderer
const mockInvoke = vi.fn();
(window as any).ipcRenderer = {
    invoke: mockInvoke
};

describe('ChangelogDialog', () => {
    const mockOnClose = vi.fn();

    const mockReleases = [
        {
            version: '1.2.0',
            date: '2023-10-01',
            body: 'Added amazing feature\nFixed a bug\nSee https://github.com/example',
            url: 'https://github.com/example/releases/tag/v1.2.0'
        },
        {
            version: '1.1.0',
            date: '2023-09-01',
            body: 'Initial release',
            url: 'https://github.com/example/releases/tag/v1.1.0'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockInvoke.mockReset();
    });

    it('renders loading state initially and then displays releases', async () => {
        mockInvoke.mockResolvedValueOnce(mockReleases);
        
        render(<ChangelogDialog onClose={mockOnClose} />);
        
        // Initially loading
        expect(screen.getByText('Fetching the latest updates...')).toBeInTheDocument();
        
        // Wait for releases to load
        await waitFor(() => {
            expect(screen.queryByText('Fetching the latest updates...')).not.toBeInTheDocument();
        });

        // Check if versions are rendered
        expect(screen.getByText('v1.2.0')).toBeInTheDocument();
        expect(screen.getByText('v1.1.0')).toBeInTheDocument();
        
        // Check if highlights are parsed
        expect(screen.getByText('Added amazing feature')).toBeInTheDocument();
        expect(screen.getByText('Fixed a bug')).toBeInTheDocument();
    });

    it('handles errors gracefully', async () => {
        mockInvoke.mockRejectedValueOnce(new Error('Network error'));
        
        render(<ChangelogDialog onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('Failed to load changelog: Network error')).toBeInTheDocument();
        });
    });

    it('opens external links when clicking GitHub button', async () => {
        mockInvoke.mockResolvedValueOnce(mockReleases);
        
        render(<ChangelogDialog onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('v1.2.0')).toBeInTheDocument();
        });

        const githubBtns = screen.getAllByRole('button', { name: /GitHub/i });
        fireEvent.click(githubBtns[0]);

        expect(mockInvoke).toHaveBeenCalledWith('app:openExternal', 'https://github.com/example/releases/tag/v1.2.0');
    });

    it('renders inline URLs as clickable buttons', async () => {
        mockInvoke.mockResolvedValueOnce(mockReleases);
        
        render(<ChangelogDialog onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('v1.2.0')).toBeInTheDocument();
        });

        const inlineLink = screen.getByRole('button', { name: /https:\/\/github\.com\/example/i });
        expect(inlineLink).toHaveClass('inline-link-btn');
        
        fireEvent.click(inlineLink);
        expect(mockInvoke).toHaveBeenCalledWith('app:openExternal', 'https://github.com/example');
    });

    it('calls onClose when Awesome! button is clicked', async () => {
        mockInvoke.mockResolvedValueOnce(mockReleases);
        
        render(<ChangelogDialog onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('v1.2.0')).toBeInTheDocument();
        });

        const awesomeBtn = screen.getByRole('button', { name: /Awesome!/i });
        fireEvent.click(awesomeBtn);
        
        expect(mockOnClose).toHaveBeenCalledOnce();
    });
});
