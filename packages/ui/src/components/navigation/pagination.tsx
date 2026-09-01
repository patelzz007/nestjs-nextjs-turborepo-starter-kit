import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
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

const Pagination = React.forwardRef<HTMLElement, PaginationProps>(function Pagination({ className, variant, size, state, ...props }, ref): React.JSX.Element {
	return <nav ref={ref} role="navigation" aria-label="pagination" data-slot="pagination" className={cn(paginationVariants({ variant, size, state }), className)} {...props} />;
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
	{ className, isActive, size = "icon", ...props },
	ref,
): React.JSX.Element {
	return (
		<Button
			variant={isActive ? "outline" : "ghost"}
			size={size}
			className={cn(className)}
			nativeButton={false}
			render={<a ref={ref} aria-current={isActive ? "page" : undefined} data-slot="pagination-link" data-active={isActive} {...props} />}
		/>
	);
});

interface PaginationNavLabels {
	readonly previous: string;
	readonly next: string;
	readonly previousAria: string;
	readonly nextAria: string;
}

function PaginationPrevious({
	className,
	text,
	labels,
	...props
}: React.ComponentProps<typeof PaginationLink> & {
	readonly text: string;
	readonly labels: Pick<PaginationNavLabels, "previousAria">;
}): React.JSX.Element {
	return (
		<PaginationLink aria-label={labels.previousAria} size="default" className={cn("ps-2!", className)} {...props}>
			<ChevronLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
			<span className="hidden sm:block">{text}</span>
		</PaginationLink>
	);
}

function PaginationNext({
	className,
	text,
	labels,
	...props
}: React.ComponentProps<typeof PaginationLink> & {
	readonly text: string;
	readonly labels: Pick<PaginationNavLabels, "nextAria">;
}): React.JSX.Element {
	return (
		<PaginationLink aria-label={labels.nextAria} size="default" className={cn("pe-2!", className)} {...props}>
			<span className="hidden sm:block">{text}</span>
			<ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
		</PaginationLink>
	);
}

function PaginationEllipsis({
	className,
	morePagesLabel,
	...props
}: React.ComponentProps<"span"> & {
	readonly morePagesLabel: string;
}): React.JSX.Element {
	return (
		<span aria-hidden data-slot="pagination-ellipsis" className={cn("flex size-9 items-center justify-center [&_svg:not([class*='size-'])]:size-4", className)} {...props}>
			<MoreHorizontalIcon />
			<span className="sr-only">{morePagesLabel}</span>
		</span>
	);
}

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, paginationVariants, type PaginationNavLabels };
