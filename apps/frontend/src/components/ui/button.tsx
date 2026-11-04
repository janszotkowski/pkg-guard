import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@lib/utils';

const buttonVariants = cva(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent font-medium whitespace-nowrap transition-[transform,background-color,color,border-color] duration-100 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground hover:bg-primary/80',
                secondary: 'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]',
            },
            size: {
                default: 'h-11 px-4 text-sm',
                lg: 'h-12 px-5 text-sm',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

const Button = (props: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) => {
    // The rest is forwarded to the primitive, so it is split off here rather than in the parameter list.
    const { className, variant = 'default', size = 'default', ...rest } = props;

    return (
        <ButtonPrimitive
            data-slot={'button'}
            className={cn(buttonVariants({ variant, size, className }))}
            {...rest}
        />
    );
};

export { Button, buttonVariants };
