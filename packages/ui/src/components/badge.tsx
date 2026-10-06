// Ported from ReUI (https://reui.io/r/base-vega/badge.json). Variants, sizes,
// radius and `data-slot` match ReUI, so its docs and examples apply, with these
// deliberate deviations:
// - Colours and type sizes route through tokens (tokens.css): solid status
//   fills use `text-status-foreground` instead of `text-white`, and the two
//   smallest sizes use `--text-badge-xs` / `--text-badge-sm` instead of
//   arbitrary rem values.
// - The `focus` variants are omitted (the kit has no `--focus` colour).
// - Kept from the kit: `ghost`, `link` and the categorical tone palette
//   (`green` … `violet`), which ReUI has no equivalent for.
// - The root forwards its ref.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const badgeVariants = cva(
	[
		"relative inline-flex w-fit shrink-0 items-center justify-center border border-transparent font-medium whitespace-nowrap transition-shadow outline-none",
		"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
		"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3",
	],
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground",
				outline: "border-border bg-transparent dark:bg-input/32",
				secondary: "bg-secondary text-secondary-foreground",
				info: "bg-info text-status-foreground",
				success: "bg-success text-status-foreground",
				warning: "bg-warning text-status-foreground",
				destructive: "bg-destructive text-status-foreground",
				invert: "bg-invert text-invert-foreground",
				"primary-light": "border-primary/10 bg-primary/10 text-primary dark:border-primary/25 dark:bg-primary/15 dark:text-primary",
				"warning-light": "border-warning/15 bg-warning/10 text-warning-foreground dark:border-warning/25 dark:bg-warning/15 dark:text-warning",
				"success-light": "border-success/15 bg-success/10 text-success-foreground dark:border-success/25 dark:bg-success/15 dark:text-success",
				"info-light": "border-info/15 bg-info/10 text-info-foreground dark:border-info/25 dark:bg-info/15 dark:text-info",
				"destructive-light": "border-destructive/15 bg-destructive/10 text-destructive-foreground dark:border-destructive/25 dark:bg-destructive/15 dark:text-destructive",
				"invert-light": "border-invert/15 bg-invert/10 text-foreground dark:border-invert/45 dark:bg-invert/35 dark:text-invert-foreground",
				"primary-outline": "border-border bg-background text-primary dark:bg-input/30",
				"warning-outline": "border-border bg-background text-warning-foreground dark:bg-input/30",
				"success-outline": "border-border bg-background text-success-foreground dark:bg-input/30",
				"info-outline": "border-border bg-background text-info-foreground dark:bg-input/30",
				"destructive-outline": "border-border bg-background text-destructive-foreground dark:bg-input/30",
				"invert-outline": "border-border bg-background text-invert-foreground dark:bg-input/30",
				ghost: "text-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/60",
				link: "text-primary underline-offset-4 hover:underline",
				// Tone palette (tokens.css): categorical chips — a soft fill with AA-contrast text in both themes.
				green: "bg-tone-green-soft text-tone-green [a]:hover:bg-tone-green-soft/80",
				blue: "bg-tone-blue-soft text-tone-blue [a]:hover:bg-tone-blue-soft/80",
				yellow: "bg-tone-yellow-soft text-tone-yellow [a]:hover:bg-tone-yellow-soft/80",
				red: "bg-tone-red-soft text-tone-red [a]:hover:bg-tone-red-soft/80",
				orange: "bg-tone-orange-soft text-tone-orange [a]:hover:bg-tone-orange-soft/80",
				teal: "bg-tone-teal-soft text-tone-teal [a]:hover:bg-tone-teal-soft/80",
				violet: "bg-tone-violet-soft text-tone-violet [a]:hover:bg-tone-violet-soft/80",
			},
			size: {
				xs: "h-4 min-w-4 gap-1 px-1 py-0.25 text-[length:var(--text-badge-xs)] leading-none",
				sm: "h-4.5 min-w-4.5 gap-1 px-1 py-0.25 text-[length:var(--text-badge-sm)] leading-none",
				default: "h-5 min-w-5 gap-1 px-1.25 py-0.5 text-xs",
				lg: "h-5.5 min-w-5.5 gap-1 px-1.5 py-0.5 text-xs",
				xl: "h-6 min-w-6 gap-1.5 px-2 py-0.75 text-sm",
			},
			/** `default`: the style's radius. `full`: pill radius. */
			radius: {
				default: "rounded-sm",
				full: "rounded-full",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
			radius: "default",
		},
	},
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

interface BadgeProps extends useRender.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge({ className, variant = "default", size, radius, render, ...props }, ref): React.ReactElement {
	return useRender({
		ref,
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(badgeVariants({ variant, size, radius }), className),
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

export { Badge, badgeVariants, type BadgeProps, type BadgeVariant };
