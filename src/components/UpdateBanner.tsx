import React from 'react';
import { Download, X, ExternalLink } from 'lucide-react';
import './UpdateBanner.css';

interface UpdateBannerProps {
    version: string;
    url: string;
    onClose: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ version, url, onClose }) => {
    return (
        <div className="update-banner">
            <div className="update-banner-content">
                <div className="update-banner-icon">
                    <Download size={14} />
                </div>
                <div className="update-banner-text">
                    New version <strong>v{version}</strong> is available
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer" className="update-banner-link">
                    Download <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                </a>
            </div>
            <button className="update-banner-close" onClick={onClose} title="Dismiss">
                <X size={14} />
            </button>
        </div>
    );
};
