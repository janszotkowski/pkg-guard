/** The cells of the plain tables on the site, shared so that their columns line up the same way everywhere. */

/** A number: right-aligned and kept on one line, with digits of one width so that the columns can be read down. */
export const NUMERIC = 'text-right tabular-nums whitespace-nowrap';

/** A column heading: the overline of the design language, as the tables of the whole family set it. */
export const HEADER_CELL = 'px-4 py-3 text-overline text-subtle-foreground uppercase';

/** A cell of text. */
export const TEXT_CELL = 'px-4 py-3';

export const NUMBER_CELL = `${TEXT_CELL} ${NUMERIC}`;
