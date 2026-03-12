import '@testing-library/jest-dom';

if (typeof window !== 'undefined') {
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };

    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }),
    });

    // Mock scrollIntoView which is absent in jsdom
    if (typeof Element !== 'undefined') {
        Element.prototype.scrollIntoView = () => {};
    }
}
