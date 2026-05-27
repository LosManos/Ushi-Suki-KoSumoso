import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Plus, Trash2 } from 'lucide-react';
import './ModalDialog.css';
import './TranslationDialog.css';

interface TranslationDialogProps {
    onClose: () => void;
    onConfirm: (mappings: Record<string, string>) => void;
    propertyPath: string;
    initialValue?: any;
    currentMappings: Record<string, string>;
}

interface MappingRow {
    id: string;
    key: string;
    translation: string;
}

export const TranslationDialog: React.FC<TranslationDialogProps> = ({
    onClose,
    onConfirm,
    propertyPath,
    initialValue,
    currentMappings = {}
}) => {
    const [rows, setRows] = useState<MappingRow[]>(() => {
        const initialRows: MappingRow[] = Object.entries(currentMappings).map(([k, v]) => ({
            id: Math.random().toString(36).substring(2, 9),
            key: k,
            translation: v
        }));

        // If specific value was clicked, ensure it exists in the list so user can translate it
        if (initialValue !== undefined) {
            const initialValueStr = String(initialValue);
            const hasInitialValue = initialRows.some(r => r.key === initialValueStr);
            if (!hasInitialValue) {
                initialRows.unshift({
                    id: Math.random().toString(36).substring(2, 9),
                    key: initialValueStr,
                    translation: ''
                });
            }
        }

        return initialRows;
    });

    const [error, setError] = useState<string>('');
    const dialogRef = useRef<HTMLDivElement>(null);
    const listEndRef = useRef<HTMLDivElement>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const previouslyFocusedElement = document.activeElement as HTMLElement;
        const timer = setTimeout(() => {
            // Auto focus translation input of first row
            if (firstInputRef.current) {
                firstInputRef.current.focus();
                firstInputRef.current.select();
            }
        }, 100);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }

            if (e.key === 'Tab') {
                if (!dialogRef.current) return;
                
                const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
                const focusableElements = Array.from(
                    dialogRef.current.querySelectorAll(focusableSelector)
                ).filter(el => {
                    const style = window.getComputedStyle(el);
                    return !(el as any).disabled && style.display !== 'none' && style.visibility !== 'hidden';
                }) as HTMLElement[];

                if (focusableElements.length === 0) return;

                const firstFocusable = focusableElements[0];
                const lastFocusable = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    // Shift + Tab (backward)
                    if (document.activeElement === firstFocusable) {
                        e.preventDefault();
                        lastFocusable.focus();
                    }
                } else {
                    // Tab (forward)
                    if (document.activeElement === lastFocusable) {
                        e.preventDefault();
                        firstFocusable.focus();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('keydown', handleKeyDown);
            if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
                previouslyFocusedElement.focus();
            }
        };
    }, [onClose]);

    const handleAddRow = () => {
        const newRow: MappingRow = {
            id: Math.random().toString(36).substring(2, 9),
            key: '',
            translation: ''
        };
        setRows(prev => [...prev, newRow]);
        setError('');
        // Smooth scroll to bottom of the list
        setTimeout(() => {
            listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    };

    const handleRemoveRow = (id: string) => {
        setRows(prev => prev.filter(r => r.id !== id));
        setError('');
    };

    const handleUpdateRow = (id: string, field: 'key' | 'translation', value: string) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
        setError('');
    };

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();

        const finalMappings: Record<string, string> = {};
        const duplicateKeys = new Set<string>();

        for (const row of rows) {
            const trimmedKey = row.key.trim();
            const trimmedTrans = row.translation.trim();

            if (!trimmedKey) continue; // Skip empty keys

            if (finalMappings[trimmedKey] !== undefined) {
                duplicateKeys.add(trimmedKey);
            }
            finalMappings[trimmedKey] = trimmedTrans;
        }

        if (duplicateKeys.size > 0) {
            setError(`Duplicate keys found: ${Array.from(duplicateKeys).map(k => `"${k}"`).join(', ')}`);
            return;
        }

        onConfirm(finalMappings);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-dialog translation-dialog-width" ref={dialogRef}>
                <div className="dialog-header">
                    <h3>Value Translation</h3>
                    <button type="button" className="close-btn" onClick={onClose} title="Close (Esc)">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleConfirm}>
                    <div className="dialog-body">
                        <div className="translation-dialog-help">
                            Define display labels for property: <code>{propertyPath}</code>. <br />
                            Matched raw database values will be replaced by your display labels in the query results.
                        </div>

                        <div className="translation-mappings-wrapper">
                            <div className="translation-mapping-header">
                                <span>Value (Key)</span>
                                <span>Display Label (Translation)</span>
                                <span></span>
                            </div>

                            <div className="translation-mappings-list">
                                {rows.map((row, index) => {
                                    const isHighlighted = initialValue !== undefined && row.key === String(initialValue);
                                    return (
                                        <div 
                                            key={row.id} 
                                            className={`translation-mapping-row ${isHighlighted ? 'highlighted' : ''}`}
                                        >
                                            <input
                                                type="text"
                                                value={row.key}
                                                onChange={(e) => handleUpdateRow(row.id, 'key', e.target.value)}
                                                placeholder="e.g. admin"
                                                aria-label="Raw Value Key"
                                                required
                                            />
                                            <input
                                                ref={index === 0 ? firstInputRef : undefined}
                                                type="text"
                                                value={row.translation}
                                                onChange={(e) => handleUpdateRow(row.id, 'translation', e.target.value)}
                                                placeholder="e.g. Administrator"
                                                aria-label="Display Translation"
                                            />
                                            <button
                                                type="button"
                                                className="delete-mapping-btn"
                                                onClick={() => handleRemoveRow(row.id)}
                                                title="Delete translation rule"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    );
                                })}
                                <div ref={listEndRef} />
                            </div>

                            <button
                                type="button"
                                className="add-mapping-btn"
                                onClick={handleAddRow}
                            >
                                <Plus size={15} />
                                Add Translation Rule
                            </button>
                        </div>

                        {error && (
                            <div className="translation-error-msg">
                                {error}
                            </div>
                        )}
                    </div>
                    <div className="dialog-footer">
                        <button type="button" className="secondary-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="primary-btn">
                            <Check size={16} />
                            OK
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
