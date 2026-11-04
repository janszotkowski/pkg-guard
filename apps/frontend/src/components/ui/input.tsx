import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from '@lib/utils';

/** A text input in the design language: generously rounded, 44 px or taller, white in light and the secondary surface in dark, a visible focus ring. */
export const Input = (props: InputPrimitive.Props) => {
    // The rest is forwarded to the primitive, so it is split off here rather than in the parameter list.
    const { className, type = 'text', ...rest } = props;

    return (
        <InputPrimitive
            type={type}
            data-slot={'input'}
            className={cn(
                'h-12 w-full min-w-0 rounded-xl border border-input bg-card px-5 dark:bg-secondary text-headline text-foreground transition-[border-color,box-shadow] duration-100 outline-none placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20',
                className,
            )}
            {...rest}
        />
    );
};
