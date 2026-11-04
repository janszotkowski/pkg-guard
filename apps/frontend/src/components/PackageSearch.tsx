import { parseSpec } from '@pkg-guard/core';
import { useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';

const INVALID_TEXT = 'Enter a package name with an optional exact version or tag. Ranges such as ^1.0.0 have no single answer.';

type PackageSearchProps = {
    /** The small form of the page header: submitted with Enter, and a bad name only marks the field. */
    compact?: boolean;
};

/** Looks up a package by name, with an optional exact version or dist-tag. Nothing is sent until the form is submitted. */
export const PackageSearch = (props: PackageSearchProps) => {
    const navigate = useNavigate();
    const fieldId = useId();
    const errorId = useId();
    const [value, setValue] = useState('');
    const [invalid, setInvalid] = useState(false);

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        const text = value.trim();
        if (parseSpec(text) === undefined) {
            setInvalid(true);
            return;
        }
        setInvalid(false);
        void navigate({ to: '/package/$', params: { _splat: text } });
    };

    return (
        <form
            role={'search'}
            onSubmit={onSubmit}
            className={'flex w-full flex-col gap-2'}
        >
            <label
                htmlFor={fieldId}
                className={'sr-only'}
            >
                Package name
            </label>
            <div className={'relative flex w-full gap-2'}>
                {props.compact === true && (
                    <Search
                        aria-hidden={'true'}
                        className={'pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground'}
                    />
                )}
                <Input
                    id={fieldId}
                    value={value}
                    onChange={(event) => {
                        setValue(event.target.value);
                        setInvalid(false);
                    }}
                    placeholder={'react or react@19.1.0'}
                    autoComplete={'off'}
                    autoCapitalize={'none'}
                    spellCheck={false}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? errorId : undefined}
                    className={props.compact === true ? 'h-10! pl-10! text-callout!' : undefined}
                />
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
