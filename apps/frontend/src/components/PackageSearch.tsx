import { MIN_SEARCH_LENGTH, parseSpec, type PackageSuggestion } from '@weighme/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { searchQuery } from '@lib/api';
import { formatCount } from '@lib/format';
import { useDebouncedValue } from '@lib/useDebouncedValue';
import { useHydrated } from '@lib/useHydrated';
import { cn } from '@lib/utils';

const INVALID_TEXT = 'Enter a package name with an optional exact version or tag. Ranges such as ^1.0.0 have no single answer.';
const DEBOUNCE_MS = 180;

/** The server does not know the visitor's keyboard, so the hint is written once the page is live. */
const shortcutHint = (): string => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K');

/** A version typed after the name means the name is already known. A leading `@` is only a scope. */
const isSearchable = (text: string): boolean => text.length >= MIN_SEARCH_LENGTH && !text.slice(1).includes('@');

type SuggestionRowProps = { id: string; suggestion: PackageSuggestion; active: boolean; onPick: () => void; onHover: () => void };

const SuggestionRow = (props: SuggestionRowProps) => (
    // The field keeps the keyboard focus: the arrows move through this list, and a click here must not blur it first.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
    <li
        id={props.id}
        role={'option'}
        aria-selected={props.active}
        onMouseDown={(event) => event.preventDefault()}
        onClick={props.onPick}
        onMouseMove={props.onHover}
        className={cn('flex cursor-pointer flex-col gap-0.5 px-4 py-2.5 text-left', props.active && 'bg-foreground/12')}
    >
        <span className={'flex items-baseline justify-between gap-3'}>
            <span className={'min-w-0 truncate text-callout font-semibold'}>{props.suggestion.name}</span>
            <span className={'shrink-0 text-caption text-subtle-foreground tabular-nums'}>
                {props.suggestion.weeklyDownloads === null ? props.suggestion.version : `${formatCount(props.suggestion.weeklyDownloads)}/week`}
            </span>
        </span>
        {props.suggestion.description !== null && <span className={'truncate text-caption font-normal text-muted-foreground'}>{props.suggestion.description}</span>}
    </li>
);

type PackageSearchProps = {
    /** The small form of the page header: submitted with Enter, and a bad name only marks the field. */
    compact?: boolean;
    /** Picking a package does this instead of opening its page. */
    onPick?: (spec: string) => void;
    /** Not the page's main search: ⌘K belongs to the one in the header. */
    secondary?: boolean;
    /** The field itself, for a parent that has to put the keyboard back in it. */
    fieldRef?: RefObject<HTMLInputElement | null>;
};

/**
 * Looks up a package by name, with an optional exact version or dist-tag, and offers matching packages from npm while
 * typing. Offering downloads nothing: only picking one measures it. A page shows one of these, and ⌘K or Ctrl+K puts the
 * cursor in it from anywhere on the page.
 */
export const PackageSearch = (props: PackageSearchProps) => {
    const navigate = useNavigate();
    const router = useRouter();
    const hydrated = useHydrated();
    const fieldId = useId();
    const errorId = useId();
    const listId = useId();
    const own = useRef<HTMLInputElement | null>(null);
    // A parent that has to put the keyboard back in the field lends its own ref; the field is otherwise this component's business.
    const field = props.fieldRef ?? own;
    const [value, setValue] = useState('');
    const [invalid, setInvalid] = useState(false);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const text = value.trim();
    const settled = useDebouncedValue(text, DEBOUNCE_MS);
    const { data } = useQuery({ ...searchQuery(settled), enabled: open && isSearchable(settled) });
    // A later answer may be shorter than the one it replaces, and what was picked in the old list means nothing in the new.
    const [seenData, setSeenData] = useState(data);
    if (data !== seenData) {
        setSeenData(data);
        setActiveIndex(-1);
    }
    const suggestions = isSearchable(text) ? (data ?? []) : [];
    const showList = open && suggestions.length > 0;
    const active = showList ? suggestions[activeIndex] : undefined;
    const activeId = active === undefined ? undefined : `${listId}-${activeIndex}`;

    // The package page's code, fetched ahead so that opening it has nothing to wait for. Should this fail, the navigation fetches it again.
    useEffect(() => {
        void Promise.resolve(router.loadRouteChunk(router.routesById['/package/$'])).catch(() => undefined);
    }, [router]);

    // The list scrolls: what the arrows reach must be in view.
    useEffect(() => {
        if (activeId !== undefined) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
    }, [activeId]);

    useEffect(() => {
        if (props.secondary === true) return undefined;
        const onKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
            event.preventDefault();
            field.current?.focus();
            field.current?.select();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [props.secondary, field]);

    const lookUp = (spec: string) => {
        setInvalid(false);
        setOpen(false);
        setActiveIndex(-1);
        setValue('');
        field.current?.blur();
        if (props.onPick === undefined) void navigate({ to: '/package/$', params: { _splat: spec } });
        else props.onPick(spec);
    };

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (active !== undefined) {
            lookUp(active.name);
            return;
        }
        if (parseSpec(text) === undefined) {
            setInvalid(true);
            return;
        }
        lookUp(text);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            setOpen(false);
            setActiveIndex(-1);
        } else if (showList && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            // One step past either end is the text as typed, with nothing picked.
            const count = suggestions.length + 1;
            setActiveIndex((current) => ((current + 1 + step + count) % count) - 1);
        }
    };

    return (
        <form
            role={'search'}
            aria-label={props.secondary === true ? 'Add a package' : 'Search npm packages'}
            onSubmit={onSubmit}
            className={'flex w-full flex-col gap-2'}
        >
            <label
                htmlFor={fieldId}
                className={'sr-only'}
            >
                Package name
            </label>
            <div className={'flex w-full gap-2'}>
                <div className={'relative min-w-0 flex-1'}>
                    {props.compact === true && (
                        <Search
                            aria-hidden={'true'}
                            className={'pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground'}
                        />
                    )}
                    <Input
                        ref={field}
                        id={fieldId}
                        value={value}
                        onChange={(event) => {
                            setValue(event.target.value);
                            setInvalid(false);
                            setOpen(true);
                            setActiveIndex(-1);
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setOpen(false)}
                        onKeyDown={onKeyDown}
                        placeholder={props.secondary === true ? 'Add a package' : 'Search npm, such as next or react@19.1.0'}
                        role={'combobox'}
                        aria-autocomplete={'list'}
                        aria-expanded={showList}
                        aria-controls={listId}
                        aria-activedescendant={activeId}
                        autoComplete={'off'}
                        autoCapitalize={'none'}
                        spellCheck={false}
                        aria-keyshortcuts={props.secondary === true ? undefined : 'Meta+K Control+K'}
                        aria-invalid={invalid}
                        aria-describedby={invalid ? errorId : undefined}
                        className={props.compact === true ? 'h-10! pr-14! pl-10! text-callout!' : 'pr-16!'}
                    />
                    {hydrated && props.secondary !== true && (
                        <kbd
                            aria-hidden={'true'}
                            className={'pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 font-sans text-caption text-subtle-foreground sm:block'}
                        >
                            {shortcutHint()}
                        </kbd>
                    )}
                    <ul
                        id={listId}
                        role={'listbox'}
                        aria-label={'Matching packages'}
                        hidden={!showList}
                        className={cn(
                            'absolute top-full z-40 mt-2 max-h-96 overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-lg',
                            props.compact === true ? 'right-0 w-[min(28rem,calc(100vw-2rem))]' : 'inset-x-0',
                            !showList && 'hidden',
                        )}
                    >
                        {suggestions.map((suggestion, index) => (
                            <SuggestionRow
                                key={suggestion.name}
                                id={`${listId}-${index}`}
                                suggestion={suggestion}
                                active={index === activeIndex}
                                onPick={() => lookUp(suggestion.name)}
                                onHover={() => setActiveIndex(index)}
                            />
                        ))}
                    </ul>
                </div>
                {props.compact !== true && (
                    <Button
                        type={'submit'}
                        size={'lg'}
                    >
                        Measure
                    </Button>
                )}
            </div>
            {invalid && (
                <p
                    id={errorId}
                    role={'alert'}
                    className={props.compact === true ? 'sr-only' : 'text-callout text-destructive'}
                >
                    {INVALID_TEXT}
                </p>
            )}
        </form>
    );
};
