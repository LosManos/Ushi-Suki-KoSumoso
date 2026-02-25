
import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, Globe } from 'lucide-react';
import './ModalDialog.css';

interface TimestampConverterDialogProps {
    onClose: () => void;
}

export const TimestampConverterDialog: React.FC<TimestampConverterDialogProps> = ({ onClose }) => {
    const [unix, setUnix] = useState<string>(Math.floor(Date.now() / 1000).toString());
    const [utc, setUtc] = useState<string>(new Date().toISOString());
    const [local, setLocal] = useState<string>(new Date().toString());

    // Focus the first input on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            document.getElementById('ts-unix')?.focus();
        }, 100);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const updateFromUnix = (value: string) => {
        setUnix(value);
        const u = parseInt(value, 10);
        if (!isNaN(u)) {
            const date = new Date(u * 1000);
            if (!isNaN(date.getTime())) {
                setUtc(date.toISOString());
                setLocal(date.toString());
            }
        }
    };

    const updateFromUtc = (value: string) => {
        setUtc(value);
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            setUnix(Math.floor(date.getTime() / 1000).toString());
            setLocal(date.toString());
        }
    };

    const updateFromLocal = (value: string) => {
        setLocal(value);
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            setUnix(Math.floor(date.getTime() / 1000).toString());
            setUtc(date.toISOString());
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-dialog timestamp-converter-dialog" style={{ maxWidth: '600px', width: '90%' }}>
                <div className="dialog-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={18} />
                        <h3>Timestamp Converter</h3>
                    </div>
                    <button className="close-btn" onClick={onClose} title="Close (Esc)">
                        <X size={18} />
                    </button>
                </div>
                <div className="dialog-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="input-group">
                        <label htmlFor="ts-unix" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <Clock size={14} /> Unix Timestamp (seconds)
                        </label>
                        <input
                            id="ts-unix"
                            type="text"
                            value={unix}
                            onChange={(e) => updateFromUnix(e.target.value)}
                            placeholder="e.g. 1740315600"
                            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-editor)', color: 'var(--text-main)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="ts-utc" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <Globe size={14} /> UTC (ISO 8601)
                        </label>
                        <input
                            id="ts-utc"
                            type="text"
                            value={utc}
                            onChange={(e) => updateFromUtc(e.target.value)}
                            placeholder="e.g. 2025-02-23T13:00:00Z"
                            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-editor)', color: 'var(--text-main)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="ts-local" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <Calendar size={14} /> Local Time
                        </label>
                        <input
                            id="ts-local"
                            type="text"
                            value={local}
                            onChange={(e) => updateFromLocal(e.target.value)}
                            placeholder="e.g. Sun Feb 23 2025 14:00:00 GMT+0100"
                            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-editor)', color: 'var(--text-main)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
                        />
                    </div>
                </div>
                <div className="dialog-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="primary-btn" onClick={onClose}>
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
