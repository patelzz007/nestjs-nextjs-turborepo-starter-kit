import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const badgeVariants = cva(
	"group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground [a]:hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_10%)] [a]:hover:text-primary-foreground",
				secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)] [a]:hover:text-secondary-foreground",
				destructive:
					"bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20 [a]:hover:text-destructive",
				outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-foreground",
				ghost: "text-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/60",
				link: "text-primary underline-offset-4 hover:underline",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

const Badge = React.forwardRef<HTMLSpanElement, useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>>(function Badge(
	{ className, variant = "default", render, ...props },
	ref,
): React.JSX.Element {
	return useRender({
		ref,
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(badgeVariants({ variant }), className),
			},
			props,
		),
		render,
		state: {
			slot: "badge",
			variant,
		},
	});
});

export { Badge, badgeVariants };
