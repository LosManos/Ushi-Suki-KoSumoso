import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Update favicon for dev mode
if (import.meta.env.DEV) {
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
        favicon.setAttribute('href', 'v_dev.png');
    }
}


ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

