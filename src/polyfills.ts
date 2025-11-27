// Polyfill localStorage for SSR environments
if (typeof window === 'undefined') {
    // @ts-ignore
    global.localStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { },
        key: () => null,
        length: 0
    };
}
