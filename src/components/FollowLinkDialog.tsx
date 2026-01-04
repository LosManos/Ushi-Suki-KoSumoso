import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import './FollowLinkDialog.css';

interface FollowLinkDialogProps {
    databases: string[];
    containers: Record<string, string[]>;
    onClose: () => void;
    onConfirm: (dbId: string, containerId: string, propertyName: string) => void;
    currentDbId: string;
    currentContainerId: string;
    selectedValue: any;
}

export const FollowLinkDialog: React.FC<FollowLinkDialogProps> = ({
    databases,
    containers,
    onClose,
    onConfirm,
    currentDbId,
    currentContainerId,
    selectedValue
}) => {
    const [selectedDb, setSelectedDb] = useState(currentDbId);
    const [selectedContainer, setSelectedContainer] = useState(currentContainerId);
    const [propertyName, setPropertyName] = useState('id');
    const dialogRef = useRef<HTMLDivElement>(null);
    const firstInputRef = useRef<HTMLSelectElement>(null);

    // Filter out symbols from selectedValue for preview
    const valuePreview = typeof selectedValue === 'object' ? JSON.stringify(selectedValue).substring(0, 50) : String(selectedValue);

    useEffect(() => {
        // Explicitly focus the first element when the dialog mounts
        // We use a small timeout to ensure we override any focus restoration 
        // from the context menu or background components.
        const timer = setTimeout(() => {
            if (firstInputRef.current) {
                firstInputRef.current.focus();
            } else {
                const firstFocusable = dialogRef.current?.querySelector('select, input, button') as HTMLElement;
                firstFocusable?.focus();
            }
        }, 100);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }

            if (e.key === 'Tab' && dialogRef.current) {
                const focusableElements = dialogRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0] as HTMLElement;
                const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

                if (e.shiftKey) { // Shift + Tab
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else { // Tab
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(selectedDb, selectedContainer, propertyName);
    };

    return (
        <div className="modal-overlay">
            <div className="follow-link-dialog" ref={dialogRef}>
                <div className="dialog-header">
                    <h3>Follow Link</h3>
                    <button className="close-btn" onClick={onClose} title="Close (Esc)"><X size={18} /></button>
                </div>
                <form onSubmit={handleConfirm}>
                    <div className="dialog-body">
                        <p className="description">
                            Linking from <code>{valuePreview}</code>
                        </p>

                        <div className="form-group">
                            <label>Database</label>
                            <select
                                ref={firstInputRef}
                                value={selectedDb}
                                onChange={(e) => {
                                    setSelectedDb(e.target.value);
                                    // Reset container if not in the new DB
                                    const dbContainers = containers[e.target.value] || [];
                                    if (!dbContainers.includes(selectedContainer)) {
                                        setSelectedContainer(dbContainers[0] || '');
                                    }
                                }}
                            >
                                {databases.map(db => (
                                    <option key={db} value={db}>{db}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Container</label>
                            <select
                                value={selectedContainer}
                                onChange={(e) => setSelectedContainer(e.target.value)}
                            >
                                {(containers[selectedDb] || []).map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Target Property Name</label>
                            <input
                                type="text"
                                value={propertyName}
                                onChange={(e) => setPropertyName(e.target.value)}
                                placeholder="e.g. id, customerId, etc."
                                required
                            />
                            <span className="help-text">Query: SELECT * FROM c WHERE c["{propertyName}"] = {JSON.stringify(selectedValue)}</span>
                        </div>
                    </div>
                    <div className="dialog-footer">
                        <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="primary-btn">
                            <ExternalLink size={16} />
                            Follow Link
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
