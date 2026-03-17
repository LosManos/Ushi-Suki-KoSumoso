// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Layout } from './Layout';
import React from 'react';

describe('Layout', () => {
    const defaultProps = {
        sidebar: <div data-testid="sidebar-content">Sidebar Content</div>,
        content: <div data-testid="main-content">Main Content</div>,
        sidebarWidth: 300,
        onSidebarMouseDown: vi.fn(),
        sidebarResizeHandleRef: { current: null },
        isDraggingSidebar: false,
        onSidebarHandleKeyDown: vi.fn()
    };

    it('renders sidebar and main content', () => {
        render(<Layout {...defaultProps} />);
        expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
        expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });

    it('applies the correct sidebar width', () => {
        render(<Layout {...defaultProps} />);
        const aside = screen.getByRole('complementary'); // <aside> maps to generic complementary role or we can select it
        expect(aside).toHaveStyle({ width: '300px' });
    });

    it('calls onSidebarMouseDown when grabber is clicked', () => {
        render(<Layout {...defaultProps} />);
        const grabber = screen.getByTitle('Resize Sidebar (Ctrl+Shift+M)');
        fireEvent.mouseDown(grabber);
        expect(defaultProps.onSidebarMouseDown).toHaveBeenCalledOnce();
    });

    it('calls onSidebarHandleKeyDown when key is pressed on grabber', () => {
        render(<Layout {...defaultProps} />);
        const grabber = screen.getByTitle('Resize Sidebar (Ctrl+Shift+M)');
        fireEvent.keyDown(grabber, { key: 'ArrowRight' });
        expect(defaultProps.onSidebarHandleKeyDown).toHaveBeenCalledOnce();
    });

    it('adds dragging class when isDraggingSidebar is true', () => {
        const { container } = render(<Layout {...defaultProps} isDraggingSidebar={true} />);
        const grabberContainer = container.querySelector('.resize-handle-vertical');
        expect(grabberContainer).toHaveClass('dragging');
    });

    it('removes dragging class when isDraggingSidebar is false', () => {
        const { container } = render(<Layout {...defaultProps} isDraggingSidebar={false} />);
        const grabberContainer = container.querySelector('.resize-handle-vertical');
        expect(grabberContainer).not.toHaveClass('dragging');
    });
});
