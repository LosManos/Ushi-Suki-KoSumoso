// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimestampConverterDialog } from './TimestampConverterDialog';
import React from 'react';

describe('TimestampConverterDialog', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock system time to ensure consistency
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-02-23T13:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('initializes with current time', () => {
        render(<TimestampConverterDialog onClose={mockOnClose} />);
        
        const unixInput = screen.getByLabelText(/Unix Timestamp/i) as HTMLInputElement;
        const utcInput = screen.getByLabelText(/UTC/i) as HTMLInputElement;
        
        expect(unixInput.value).toBe('1740315600');
        expect(utcInput.value).toBe('2025-02-23T13:00:00.000Z');
    });

    it('updates UTC and Local when Unix changes', () => {
        render(<TimestampConverterDialog onClose={mockOnClose} />);
        
        const unixInput = screen.getByLabelText(/Unix Timestamp/i) as HTMLInputElement;
        const utcInput = screen.getByLabelText(/UTC/i) as HTMLInputElement;
        
        // 1700000000 = 2023-11-14T22:13:20.000Z
        fireEvent.change(unixInput, { target: { value: '1700000000' } });
        
        expect(utcInput.value).toBe('2023-11-14T22:13:20.000Z');
    });

    it('updates Unix when UTC changes', () => {
        render(<TimestampConverterDialog onClose={mockOnClose} />);
        
        const unixInput = screen.getByLabelText(/Unix Timestamp/i) as HTMLInputElement;
        const utcInput = screen.getByLabelText(/UTC/i) as HTMLInputElement;
        
        fireEvent.change(utcInput, { target: { value: '2024-01-01T00:00:00Z' } });
        
        // 2024-01-01T00:00:00Z = 1704067200
        expect(unixInput.value).toBe('1704067200');
    });

    it('calls onClose when Done button is clicked', () => {
        render(<TimestampConverterDialog onClose={mockOnClose} />);
        
        const doneBtn = screen.getByRole('button', { name: /Done/i });
        fireEvent.click(doneBtn);
        
        expect(mockOnClose).toHaveBeenCalledOnce();
    });
});
