"use client";

import { Button, buttonVariants } from "@workspace/ui/components/button";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import * as React from "react";

const paginationVariants = cva("mx-auto flex w-full justify-center", {
	variants: {
		variant: {
			default: "",
		},
		size: {
			default: "",
			sm: "text-sm",
		},
		state: {
			default: "",
			loading: "pointer-events-none opacity-60",
			disabled: "pointer-events-none opacity-50",
			error: "",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
		state: "default",
	},
});

type PaginationProps = React.ComponentProps<"nav"> & VariantProps<typeof paginationVariants>;

/**
 * The `<nav>` landmark. Its accessible name comes from the `pagination` family
 * (`UiKitLabelsProvider`); an `aria-label` passed here overrides it for this usage.
 */
const Pagination = React.forwardRef<HTMLElement, PaginationProps>(function Pagination(
	{ className, variant, size, state, "aria-label": ariaLabel, ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("pagination");
	return (
		<nav ref={ref} aria-label={ariaLabel ?? labels.ariaLabel} data-slot="pagination" className={cn(paginationVariants({ variant, size, state }), className)} {...props} />
	);
});

const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(function PaginationContent({ className, ...props }, ref): React.JSX.Element {
	return <ul ref={ref} data-slot="pagination-content" className={cn("flex items-center gap-1", className)} {...props} />;
});

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(function PaginationItem({ ...props }, ref): React.JSX.Element {
	return <li ref={ref} data-slot="pagination-item" {...props} />;
});

type PaginationLinkProps = {
	isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
	React.ComponentProps<"a">;

const PaginationLink = React.forwardRef<HTMLAnchorElement, PaginationLinkProps>(function PaginationLink(
	{ className, isActive, size = "icon", children, ...props },
	ref,
): React.JSX.Element {
	// A real link styled as a button — `Button` rendering an `<a>` would add
	// `role="button"`, and screen readers would announce navigation as a button.
	return (
		<a
			ref={ref}
			aria-current={isActive ? "page" : undefined}
			data-slot="pagination-link"
			data-active={isActive}
			className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), className)}
			{...props}>
			{children}
		</a>
	);
});

interface PaginationNavLabels {
	readonly previous: string;
	readonly next: string;
	readonly previousAria: string;
	readonly nextAria: string;
}

type PaginationPreviousProps = React.ComponentProps<typeof PaginationLink> & {
	readonly text: string;
	readonly labels: Pick<PaginationNavLabels, "previousAria">;
};

const PaginationPrevious = React.forwardRef<HTMLAnchorElement, PaginationPreviousProps>(function PaginationPrevious(
	{ className, text, labels, ...props },
	ref,
): React.JSX.Element {
	return (
		<PaginationLink ref={ref} aria-label={labels.previousAria} size="default" className={cn("ps-2!", className)} {...props}>
			<ChevronLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
			<span className="hidden sm:block">{text}</span>
		</PaginationLink>
	);
});

type PaginationNextProps = React.ComponentProps<typeof PaginationLink> & {
	readonly text: string;
	readonly labels: Pick<PaginationNavLabels, "nextAria">;
};

const PaginationNext = React.forwardRef<HTMLAnchorElement, PaginationNextProps>(function PaginationNext({ className, text, labels, ...props }, ref): React.JSX.Element {
	return (
		<PaginationLink ref={ref} aria-label={labels.nextAria} size="default" className={cn("pe-2!", className)} {...props}>
			<span className="hidden sm:block">{text}</span>
			<ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
		</PaginationLink>
	);
});

type PaginationEllipsisProps = React.ComponentProps<"span"> & {
	readonly morePagesLabel: string;
};

const PaginationEllipsis = React.forwardRef<HTMLSpanElement, PaginationEllipsisProps>(function PaginationEllipsis(
	{ className, morePagesLabel, ...props },
	ref,
): React.JSX.Element {
	return (
		<span
			ref={ref}
			aria-hidden
			data-slot="pagination-ellipsis"
			className={cn("flex size-9 items-center justify-center [&_svg:not([class*='size-'])]:size-4", className)}
			{...props}>
			<MoreHorizontalIcon />
			<span className="sr-only">{morePagesLabel}</span>
		</span>
	);
});

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, paginationVariants, type PaginationNavLabels };
