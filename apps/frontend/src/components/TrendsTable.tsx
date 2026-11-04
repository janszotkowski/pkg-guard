import { Link } from '@tanstack/react-router';
import { createColumnHelper, createSortedRowModel, rowSortingFeature, sortFn_alphanumeric, sortFn_basic, tableFeatures, useTable, type SortingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { npmUrl } from '@components/PackageLinks';
import { formatCount, formatSizeText } from '@lib/format';
import { cn } from '@lib/utils';

export type TrendsTableRow = {
    name: string;
    version: string | undefined;
    color: string;
    /** Says why there are no sizes, when there are none. */
    state: string | undefined;
    gzip: number | undefined;
    minified: number | undefined;
    install: number | undefined;
    weekly: number | undefined;
    stars: number | undefined;
    repositoryUrl: string | undefined;
};

/** Sorted here in the browser: the rows are the few packages on the page. Defined once, outside the component, so it stays stable. */
const features = tableFeatures({
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

const helper = createColumnHelper<typeof features, TrendsTableRow>();

const NUMERIC = 'text-right tabular-nums whitespace-nowrap';

const COLUMN_CLASS: Record<string, string> = {
    name: 'w-full min-w-48',
    gzip: NUMERIC,
    minified: NUMERIC,
    install: `${NUMERIC} hidden sm:table-cell`,
    weekly: `${NUMERIC} hidden md:table-cell`,
    stars: `${NUMERIC} hidden md:table-cell`,
    remove: 'w-10',
};

const orDash = (value: number | undefined, format: (value: number) => string): string => (value === undefined ? '—' : format(value));

const SMALL_LINK = 'inline-flex min-h-6 items-center text-caption text-link underline-offset-2 hover:underline';

const buildColumns = (onRemove: (name: string) => void) =>
    helper.columns([
        helper.accessor('name', {
            header: 'Package',
            sortFn: 'alphanumeric',
            cell: (info) => {
                const row = info.row.original;
                return (
                    <div className={'flex items-center gap-2.5'}>
                        <span
                            aria-hidden={'true'}
                            className={'size-2.5 shrink-0 rounded-xs'}
                            style={{ background: row.color }}
                        />
                        <div className={'flex min-w-0 flex-col'}>
                            <Link
                                to={'/package/$'}
                                params={{ _splat: row.name }}
                                className={'inline-flex min-h-6 items-center font-mono text-code font-semibold break-all text-link underline-offset-2 hover:underline'}
                            >
                                {row.name}
                            </Link>
                            <span className={'flex flex-wrap items-baseline gap-x-3'}>
                                {row.version !== undefined && <span className={'text-caption text-subtle-foreground'}>{row.version}</span>}
                                {row.version !== undefined && (
                                    <a
                                        href={npmUrl({ name: row.name, version: row.version })}
                                        target={'_blank'}
                                        rel={'noreferrer'}
                                        className={SMALL_LINK}
                                    >
                                        npm
                                    </a>
                                )}
                                {row.repositoryUrl !== undefined && (
                                    <a
                                        href={row.repositoryUrl}
                                        target={'_blank'}
                                        rel={'noreferrer'}
                                        className={SMALL_LINK}
                                    >
                                        GitHub
                                    </a>
                                )}
                            </span>
                        </div>
                    </div>
                );
            },
        }),
        helper.accessor('gzip', {
            header: 'Gzip',
            sortFn: 'basic',
            sortUndefined: 'last',
            cell: (info) => {
                const state = info.row.original.state;
                return state === undefined ? <span className={'font-semibold'}>{orDash(info.getValue(), formatSizeText)}</span> : <span className={'text-caption text-muted-foreground'}>{state}</span>;
            },
        }),
        helper.accessor('minified', { header: 'Minified', sortFn: 'basic', sortUndefined: 'last', cell: (info) => orDash(info.getValue(), formatSizeText) }),
        helper.accessor('install', { header: 'Install', sortFn: 'basic', sortUndefined: 'last', cell: (info) => orDash(info.getValue(), formatSizeText) }),
        helper.accessor('weekly', { header: 'Weekly downloads', sortFn: 'basic', sortUndefined: 'last', cell: (info) => orDash(info.getValue(), formatCount) }),
        helper.accessor('stars', { header: 'Stars', sortFn: 'basic', sortUndefined: 'last', cell: (info) => orDash(info.getValue(), formatCount) }),
        helper.display({
            id: 'remove',
            header: () => <span className={'sr-only'}>Remove</span>,
            cell: (info) => (
                <button
                    type={'button'}
                    aria-label={`Remove ${info.row.original.name}`}
                    onClick={() => onRemove(info.row.original.name)}
                    className={'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'}
                >
                    <X
                        aria-hidden={'true'}
                        className={'size-4'}
                    />
                </button>
            ),
        }),
    ]);

type TrendsTableProps = { rows: TrendsTableRow[]; onRemove: (name: string) => void };

/** Today's numbers of the packages on the page, smallest first until the visitor sorts otherwise. */
export const TrendsTable = (props: TrendsTableProps) => {
    const [sorting, setSorting] = useState<SortingState>([{ id: 'gzip', desc: false }]);
    const { onRemove } = props;
    const columns = useMemo(() => buildColumns(onRemove), [onRemove]);
    const table = useTable({
        features,
        columns,
        data: props.rows,
        getRowId: (row) => row.name,
        enableSortingRemoval: false,
        enableMultiSort: false,
        state: { sorting },
        onSortingChange: setSorting,
    });

    return (
        <div className={'overflow-x-auto'}>
            <table className={'w-full text-left text-callout'}>
                <caption className={'sr-only'}>The compared packages and their current numbers</caption>
                <thead>
                    {table.getHeaderGroups().map((group) => (
                        <tr
                            key={group.id}
                            className={'border-b'}
                        >
                            {group.headers.map((header) => {
                                const sorted = header.column.getIsSorted();
                                const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
                                return (
                                    <th
                                        key={header.id}
                                        scope={'col'}
                                        aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                                        className={cn('px-3 py-2 text-caption font-medium text-muted-foreground first:pl-0', COLUMN_CLASS[header.column.id])}
                                    >
                                        {header.column.getCanSort() ? (
                                            <button
                                                type={'button'}
                                                onClick={header.column.getToggleSortingHandler()}
                                                className={'inline-flex min-h-8 items-center gap-1 whitespace-nowrap outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'}
                                            >
                                                <table.FlexRender header={header} />
                                                <Icon
                                                    aria-hidden={'true'}
                                                    className={cn('size-3.5', sorted === false && 'opacity-50')}
                                                />
                                            </button>
                                        ) : (
                                            <table.FlexRender header={header} />
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((row) => (
                        <tr
                            key={row.id}
                            className={'border-b last:border-0'}
                        >
                            {row.getAllCells().map((cell) => (
                                // The cell content comes from FlexRender, which the rule cannot see into.
                                // oxlint-disable-next-line jsx-a11y/control-has-associated-label
                                <td
                                    key={cell.id}
                                    className={cn('px-3 py-3 first:pl-0', COLUMN_CLASS[cell.column.id])}
                                >
                                    <table.FlexRender cell={cell} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
