import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { currentTheme, setTheme, type Theme } from '@lib/theme';
import { useHydrated } from '@lib/useHydrated';
import { cn } from '@lib/utils';

type ThemeToggleProps = { className?: string };

/**
 * Switches between the dark and the light theme and remembers the choice. The server cannot know the theme
 * (the boot script picks it before paint), so the button reads it once mounted and shows the other one as the action.
 */
export const ThemeToggle = (props: ThemeToggleProps) => {
    const hydrated = useHydrated();
    const [chosen, setChosen] = useState<Theme | undefined>(undefined);
    // The server renders dark; once hydrated the page's real theme is read from the document.
    const theme = chosen ?? (hydrated ? currentTheme() : 'dark');
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    const Icon = next === 'light' ? Sun : Moon;

    return (
        <button
            type={'button'}
            aria-label={next === 'light' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => {
                setTheme(next);
                setChosen(next);
            }}
            className={cn(
                'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                props.className,
            )}
        >
            <Icon
                aria-hidden={'true'}
                className={'size-5'}
            />
        </button>
    );
};
