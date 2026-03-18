import React from 'react';
import { Download, X, RefreshCw, AlertCircle } from 'lucide-react';
import './UpdateBanner.css';

interface UpdateBannerProps {
    version: string;
    status: 'available' | 'downloading' | 'downloaded' | 'error';
    progress?: number;
    error?: string;
    onClose: () => void;
    onShowChangelog: () => void;
    onDownload: () => void;
    onInstall: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ 
    version, 
    status, 
    progress, 
    error,
    onClose, 
    onShowChangelog,
    onDownload,
    onInstall
}) => {
    return (
        <div className={`update-banner update-status-${status}`}>
            <div className="update-banner-content">
                <div className="update-banner-icon">
                    {status === 'error' ? <AlertCircle size={14} /> : <Download size={14} />}
                </div>
                
                <div className="update-banner-text">
                    {status === 'available' && <>New version <strong>v{version}</strong> is available</>}
                    {status === 'downloading' && (
                        <>Downloading update... <strong>{Math.round(progress || 0)}%</strong></>
                    )}
                    {status === 'downloaded' && <>Update <strong>v{version}</strong> is ready to install</>}
                    {status === 'error' && <>Update error: {error || 'Unknown error'}</>}
                </div>

                {status === 'downloading' && (
                    <div className="update-banner-progress-container">
                        <div className="update-banner-progress-bar" style={{ width: `${progress || 0}%` }}></div>
                    </div>
                )}

                {(status === 'available' || status === 'downloaded' || status === 'error') && (
                    <button className="update-banner-action" onClick={onShowChangelog}>
                        Changelog...
                    </button>
                )}

                <div className="update-banner-divider"></div>

                {status === 'downloaded' ? (
                    <button className="update-banner-install" onClick={onInstall}>
                        <RefreshCw size={12} style={{ marginRight: '4px' }} /> Restart to Update
                    </button>
                ) : status === 'available' ? (
                    <button className="update-banner-install" onClick={onDownload}>
                        <Download size={12} style={{ marginRight: '4px' }} /> Download Update
                    </button>
                ) : (
                    <div className="update-banner-info-text">
                        Automated update via electron-updater
                    </div>
                )}
            </div>
            <button className="update-banner-close" onClick={onClose} title="Dismiss">
                <X size={14} />
            </button>
        </div>
    );
};
