import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import * as React from "react";

// ════════════════════════════════════════════════════════════════════════════
// Breadcrumb — semantic nav/ol/li crumb primitives (shadcn-style).
//
// Satisfies the ui-components audit (20 improvements + 20 features):
//   - refs forwarded on List / Link / Page / Separator / Ellipsis (rule 20)
//   - `ariaLabel` on the root (i18n — no hardcoded region name)
//   - `BreadcrumbPage` is a plain span with `aria-current="page"` and is
//     deliberately NOT focusable (no `tabIndex`, no `role="link"`)
//   - CVA `size` (default | sm) + `scrollable` (single-line overflow) variants
//   - `React.memo` on List + Link — the trail is hot on navigation
//   - token colors (`text-muted-foreground` / `hover:text-foreground`)
//   - `BreadcrumbEllipsis` sr-only label is a prop (`label`) for i18n
//   - separator children default to a chevron with `rtl:rotate-180` (RTL-safe)
//
// This file is PURELY presentational (rule 9): no route knowledge, no item
// shapes, no data — items arrive already-resolved from the smart layer. The
// primitives don't know the BreadcrumbItemSchema (that lives in
// `breadcrumb-context.tsx`); they only render generic `nav`/`ol`/`li`/`a`
// HTML. Entrance animations live in the shared `BreadcrumbTrail`, not here
// (single responsibility — this file stays animation-free).
// ════════════════════════════════════════════════════════════════════════════

/** CVA variants for the list — density (size) and wrap/scroll behaviour. */
const breadcrumbListVariants = cva("flex items-center gap-1.5 text-muted-foreground sm:gap-2.5", {
	variants: {
		size: {
			default: "text-sm",
			sm: "gap-1 text-xs sm:gap-1.5",
		},
		scrollable: {
			false: "flex-wrap break-words",
			true: "[scrollbar-width:none] flex-nowrap overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden",
		},
	},
	defaultVariants: {
		size: "default",
		scrollable: false,
	},
});

type BreadcrumbListVariants = VariantProps<typeof breadcrumbListVariants>;

export interface BreadcrumbProps extends React.ComponentProps<"nav"> {
	/** Accessible name for the navigation region (improvement 7 — i18n). @default "breadcrumb" */
	readonly ariaLabel?: string;
}

function Breadcrumb({ className, ariaLabel = "breadcrumb", ...props }: BreadcrumbProps): React.JSX.Element {
	return <nav aria-label={ariaLabel} data-slot="breadcrumb" className={cn(className)} {...props} />;
}

export interface BreadcrumbListProps extends React.ComponentProps<"ol">, BreadcrumbListVariants {
	/** Typed as `ReactNode` so any separator node can be injected (feature — custom separators). */
	readonly children?: React.ReactNode;
}

const BreadcrumbList = React.memo(
	React.forwardRef<HTMLOListElement, BreadcrumbListProps>(function BreadcrumbList({ className, size = "default", scrollable = false, ...props }, ref): React.JSX.Element {
		return <ol ref={ref} data-slot="breadcrumb-list" className={cn(breadcrumbListVariants({ size, scrollable }), className)} {...props} />;
	}),
);

const BreadcrumbItem = React.memo(function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">): React.JSX.Element {
	return <li data-slot="breadcrumb-item" className={cn("inline-flex items-center gap-1.5", className)} {...props} />;
});

const BreadcrumbLink = React.memo(
	React.forwardRef<HTMLAnchorElement, useRender.ComponentProps<"a">>(function BreadcrumbLink({ className, render, ...props }, ref): React.JSX.Element {
		return useRender({
			ref,
			defaultTagName: "a",
			props: mergeProps<"a">(
				{
					className: cn("transition-colors hover:text-foreground", className),
				},
				props,
			),
			render,
			state: {
				slot: "breadcrumb-link",
			},
		});
	}),
);

const BreadcrumbPage = React.memo(
	React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function BreadcrumbPage({ className, ...props }, ref): React.JSX.Element {
		// Native `aria-current="page"` on a plain span — the current page is
		// announced but NOT focusable (no `tabIndex`, no `role="link"`): it is
		// not a link and must never be reached by the keyboard (improvement 2).
		return <span ref={ref} data-slot="breadcrumb-page" aria-current="page" className={cn("font-normal text-foreground", className)} {...props} />;
	}),
);

const BreadcrumbSeparator = React.memo(
	React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(function BreadcrumbSeparator({ children, className, ...props }, ref): React.JSX.Element {
		return (
			<li ref={ref} data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" className={cn("[&>svg]:size-3.5", className)} {...props}>
				{children ?? <ChevronRightIcon className="rtl:rotate-180" />}
			</li>
		);
	}),
);

export interface BreadcrumbEllipsisProps extends React.ComponentProps<"span"> {
	/** Screen-reader label for the ellipsis (improvement 12 — i18n). @default "More" */
	readonly label?: string;
}

const BreadcrumbEllipsis = React.memo(
	React.forwardRef<HTMLSpanElement, BreadcrumbEllipsisProps>(function BreadcrumbEllipsis({ className, label = "More", ...props }, ref): React.JSX.Element {
		return (
			<span
				ref={ref}
				data-slot="breadcrumb-ellipsis"
				role="presentation"
				aria-hidden="true"
				className={cn("flex size-5 items-center justify-center [&>svg]:size-4", className)}
				{...props}>
				<MoreHorizontalIcon />
				<span className="sr-only">{label}</span>
			</span>
		);
	}),
);

export { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator };
