// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateBanner } from './UpdateBanner';
import React from 'react';

describe('UpdateBanner', () => {
    const defaultProps = {
        version: '1.2.3',
        status: 'available' as const,
        onClose: vi.fn(),
        onShowChangelog: vi.fn(),
        onDownload: vi.fn(),
        onInstall: vi.fn()
    };

    it('renders the version number correctly', () => {
        render(<UpdateBanner {...defaultProps} />);
        expect(screen.getByText(/New version/i)).toBeInTheDocument();
        expect(screen.getByText('v1.2.3')).toBeInTheDocument();
    });

    it('renders the download button correctly', () => {
        render(<UpdateBanner {...defaultProps} />);
        const downloadBtn = screen.getByRole('button', { name: /Download Update/i });
        expect(downloadBtn).toBeInTheDocument();
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
