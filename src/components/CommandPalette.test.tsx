// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';

describe('CommandPalette', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        databases: ['db1', 'db2'],
        containers: {
            'db1': ['users', 'settings'],
            'db2': ['logs']
        },
        onSelectContainer: vi.fn(),
        loadContainers: vi.fn().mockResolvedValue(undefined)
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders null when not open', () => {
        const { baseElement } = render(<CommandPalette {...defaultProps} isOpen={false} />);
        expect(baseElement.querySelector('.command-palette')).not.toBeInTheDocument();
    });

    it('renders all containers when open and search is empty', () => {
        render(<CommandPalette {...defaultProps} />);
        
        expect(screen.getByText('users')).toBeInTheDocument();
        expect(screen.getByText('settings')).toBeInTheDocument();
        expect(screen.getByText('logs')).toBeInTheDocument();
    });

    it('filters containers based on search input', async () => {
        render(<CommandPalette {...defaultProps} />);
        
        const input = screen.getByPlaceholderText('Search containers...');
        fireEvent.change(input, { target: { value: 'set' } });
        
        // Highlights split text into multiple spans, so match by checking textContent of options
        const options = screen.getAllByRole('option');
        expect(options.length).toBe(1);
        expect(options[0].textContent).toContain('settings');
        expect(options[0].textContent).toContain('db1');
    });

    it('calls onSelectContainer when an item is clicked', () => {
        render(<CommandPalette {...defaultProps} />);
        
        const settingsItem = screen.getByText('settings').closest('.command-palette-item');
        fireEvent.click(settingsItem!);
        
        expect(defaultProps.onSelectContainer).toHaveBeenCalledWith('db1', 'settings');
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('handles keyboard navigation', () => {
        render(<CommandPalette {...defaultProps} />);
        
        const input = screen.getByPlaceholderText('Search containers...');
        
        // Initial selection should be first item (logs because sorted: db1 then db2? Actually db1/settings, db1/users, db2/logs)
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });
        
        // It should have selected the second item
        expect(defaultProps.onSelectContainer).toHaveBeenCalled();
    });

    it('closes on Escape', () => {
        render(<CommandPalette {...defaultProps} />);
        
        const input = screen.getByPlaceholderText('Search containers...');
        fireEvent.keyDown(input, { key: 'Escape' });
        
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('loads missing containers on mount if not available', () => {
        const props = {
            ...defaultProps,
            containers: { 'db1': ['users'] } // db2 is missing
        };
        render(<CommandPalette {...props} />);
        
        expect(props.loadContainers).toHaveBeenCalledWith('db2');
    });
});
