/** Browser color of the surrounding chrome per theme (matches `--background`). */
export const THEME_COLOR = { dark: '#000000', light: '#fbfbfd' } as const;

const THEME_STORAGE_KEY = 'pkg-guard-theme';

/**
 * Runs before first paint. The site is dark by default; only a visitor who switched to light (stored by `setTheme`) gets
 * light, before the first paint so there is no flash. Wrapped in try/catch because storage can be blocked, which leaves the page dark.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=localStorage.getItem('${THEME_STORAGE_KEY}')!=='light';var r=document.documentElement;r.classList.toggle('dark',d);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'${THEME_COLOR.dark}':'${THEME_COLOR.light}')}catch(e){}})()`;

export type Theme = 'dark' | 'light';

/** The theme the page shows now (set by the boot script, or by `setTheme`). */
export const currentTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

/** Shows a theme and remembers it as the visitor's choice; storage that is blocked only means it is not remembered. */
export const setTheme = (theme: Theme): void => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // Private mode or blocked storage: the theme still changes for this page.
    }
};
