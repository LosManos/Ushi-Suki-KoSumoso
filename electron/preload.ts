import { contextBridge, ipcRenderer } from 'electron';

// --------- Expose some API to the Renderer process ---------
const _ipcListeners = new Map<string, Map<any, any>>();

contextBridge.exposeInMainWorld('ipcRenderer', {
    on(channel: string, listener: (...args: any[]) => void) {
        const wrapper = (_event: any, ...args: any[]) => listener(...args);

        let channelListeners = _ipcListeners.get(channel);
        if (!channelListeners) {
            channelListeners = new Map();
            _ipcListeners.set(channel, channelListeners);
        }
        channelListeners.set(listener, wrapper);

        ipcRenderer.on(channel, wrapper);
    },
    off(channel: string, listener: (...args: any[]) => void) {
        const channelListeners = _ipcListeners.get(channel);
        const wrapper = channelListeners?.get(listener);
        if (wrapper) {
            ipcRenderer.off(channel, wrapper);
            channelListeners?.delete(listener);
        }
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...omit] = args;
        return ipcRenderer.send(channel, ...omit);
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...omit] = args;
        return ipcRenderer.invoke(channel, ...omit);
    },

    // You can expose other APTs you need here.
    // ...
});
