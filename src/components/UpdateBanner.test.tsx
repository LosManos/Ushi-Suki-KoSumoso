// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateBanner } from './UpdateBanner';
import React from 'react';

describe('UpdateBanner', () => {
    const defaultProps = {
        version: '1.2.3',
        url: 'https://github.com/example/releases/tag/v1.2.3',
        onClose: vi.fn(),
        onShowChangelog: vi.fn()
    };

    it('renders the version number correctly', () => {
        render(<UpdateBanner {...defaultProps} />);
        expect(screen.getByText(/New version/i)).toBeInTheDocument();
        expect(screen.getByText('v1.2.3')).toBeInTheDocument();
    });

    it('renders the external download link correctly', () => {
        render(<UpdateBanner {...defaultProps} />);
        const link = screen.getByRole('link', { name: /Download/i });
        expect(link).toHaveAttribute('href', defaultProps.url);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('calls onClose when the close button is clicked', () => {
        render(<UpdateBanner {...defaultProps} />);
        const closeBtn = screen.getByRole('button', { name: /Dismiss/i });
        fireEvent.click(closeBtn);
        expect(defaultProps.onClose).toHaveBeenCalledOnce();
    });

    it('calls onShowChangelog when the changelog button is clicked', () => {
        render(<UpdateBanner {...defaultProps} />);
        const changelogBtn = screen.getByRole('button', { name: /Changelog/i });
        fireEvent.click(changelogBtn);
        expect(defaultProps.onShowChangelog).toHaveBeenCalledOnce();
    });
});
