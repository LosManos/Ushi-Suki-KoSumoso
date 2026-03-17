// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ContextMenu } from './ContextMenu';

describe('ContextMenu', () => {
    const mockOnClose = vi.fn();
    const mockOnClickA = vi.fn();
    const mockOnClickB = vi.fn();

    const sampleItems = [
        { label: 'Action A', onClick: mockOnClickA, accessKey: 'a' },
        { divider: true },
        { label: 'Action B', onClick: mockOnClickB, shortcut: 'Ctrl+B' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('renders menu items and portals to body', () => {
        const { baseElement } = render(
            <ContextMenu x={100} y={150} items={sampleItems} onClose={mockOnClose} />
        );
        
        // Contextual menu portalled to the end of body
        expect(baseElement.querySelector('.context-menu')).toBeInTheDocument();
        
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems[0]).toHaveTextContent('Action A');
        expect(menuItems[1]).toHaveTextContent('Action B');
        expect(menuItems[1]).toHaveTextContent('Ctrl+B');
    });

    it('calls onClick and onClose when an item is clicked', () => {
        render(<ContextMenu x={10} y={10} items={sampleItems} onClose={mockOnClose} />);
        
        const itemB = screen.getByText('Action B').closest('.context-menu-item') as HTMLElement;
        fireEvent.click(itemB);
        
        expect(mockOnClickB).toHaveBeenCalledOnce();
        expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('calls onClose when clicking outside', () => {
        render(<ContextMenu x={10} y={10} items={sampleItems} onClose={mockOnClose} />);
        
        // Dispatches on document to simulate click outside portal
        fireEvent.mouseDown(document.body);
        
        expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('supports access keys triggers', () => {
        render(<ContextMenu x={10} y={10} items={sampleItems} onClose={mockOnClose} />);
        
        const menu = document.querySelector('.context-menu') as HTMLElement;
        
        // Pressing 'a' should trigger Action A because its accessKey is 'a'
        fireEvent.keyDown(menu, { key: 'a' });
        
        expect(mockOnClickA).toHaveBeenCalledOnce();
        expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('supports Esc key to close', () => {
        render(<ContextMenu x={10} y={10} items={sampleItems} onClose={mockOnClose} />);
        
        const menu = document.querySelector('.context-menu') as HTMLElement;
        fireEvent.keyDown(menu, { key: 'Escape' });
        
        expect(mockOnClose).toHaveBeenCalledOnce();
    });
});
