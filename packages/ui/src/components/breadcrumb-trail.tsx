"use client";

import { Check, Copy, LinkIcon, Loader2 } from "lucide-react";
import * as React from "react";

import { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";

import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";

import type { BreadcrumbItem as BreadcrumbItemData } from "@workspace/ui/components/breadcrumb-context";

import { cn } from "@workspace/ui/lib/utils";

/**
 * Shared, presentational breadcrumb trail. It knows nothing about routing or
 * menus — it receives the resolved crumbs via props and renders them with
 * **mandatory icons** on every crumb.
 *
 * Rendering features:
 * - `maxItems` collapse: the first crumb + the last `maxItems - 1` are shown;
 *   the hidden middle becomes a **popover** listing every hidden crumb as a
 *   link (click/hover the ellipsis to jump to one).
 * - A **copy-link** button after the last crumb (appears on hover at `sm`+,
 *   always visible on touch) that copies the current page URL.
 * - `title` tooltips on labels (for long/truncated names), hover + focus
 *   states on every link, and `font-medium text-foreground` on the current
 *   page crumb so "you are here" reads instantly.
 * - A light **entrance animation** (tw-animate-css fade + slide) that replays
 *   whenever the trail changes.
 * - **Status placeholders**: `loading` renders a skeleton, `error` a muted
 *   message — data-driven pages never show a stale trail.
 *
 * The component is framework-free: `renderLink` is supplied by the host app
 * (admin/web) so `packages/ui` never imports `next/link`.
 */

interface BreadcrumbTrailProps {
	readonly items: readonly BreadcrumbItemData[];
	readonly status: "loading" | "error" | "ready";
	readonly errorMessage?: string;
	/** Collapse threshold — defaults to 4 (first + ellipsis + last 3). Pass 2 for a compact mobile trail. */
	readonly maxItems?: number;
	/** App-supplied link renderer (e.g. a Next.js `Link`) — returns the bare link element the crumb wraps. */
	readonly renderLink: (item: BreadcrumbItemData) => React.ReactElement;
}

const DEFAULT_MAX_ITEMS = 4;

/** Copy the current page URL to the clipboard, falling back to `document.title` text. */
async function copyCurrentUrl(): Promise<boolean> {
	const url = `${window.location.origin}${window.location.pathname}`;
	try {
		await navigator.clipboard.writeText(url);
		return true;
	} catch {
		try {
			await navigator.clipboard.writeText(document.title);
			return true;
		} catch {
			return false;
		}
	}
}

/** Copy-link button: appears on hover at `sm`+, always visible on touch, with a transient "copied" state. */
function CopyLinkButton(): React.JSX.Element {
	const [copied, setCopied] = React.useState(false);
	const [failed, setFailed] = React.useState(false);

	const timeoutRef = React.useRef<number | null>(null);

	React.useEffect(() => {
		return (): void => {
			if (timeoutRef.current !== null) {
				window.clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	const handleCopy = React.useCallback((): void => {
		if (timeoutRef.current !== null) {
			window.clearTimeout(timeoutRef.current);
		}
		void copyCurrentUrl().then((ok: boolean) => {
			setCopied(ok);
			setFailed(!ok);
			timeoutRef.current = window.setTimeout(() => {
				setCopied(false);
				setFailed(false);
				timeoutRef.current = null;
			}, 2000);
		});
	}, []);

	return (
		<button
			type="button"
			onClick={handleCopy}
			aria-label="Copy link to this page"
			title={failed ? "Could not copy — selected address bar manually" : "Copy link to this page"}
			className={cn(
				"inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/50 transition-all",
				"hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
				copied ? "text-emerald-600" : failed ? "text-destructive" : "sm:opacity-0 sm:group-hover/breadcrumb:opacity-100 sm:focus-visible:opacity-100",
			)}>
			{copied ? <Check className="size-3.5" /> : failed ? <Copy className="size-3.5" /> : <LinkIcon className="size-3.5" />}
		</button>
	);
}

/** Popover listing the hidden (collapsed) crumbs as links. */
function HiddenCrumbsPopover({
	hidden,
	renderLink,
}: {
	readonly hidden: readonly BreadcrumbItemData[];
	readonly renderLink: (item: BreadcrumbItemData) => React.ReactElement;
}): React.JSX.Element {
	return (
		<Popover>
			<PopoverTrigger
				render={
					<button
						type="button"
						aria-label="More breadcrumbs"
						title="Show all breadcrumbs"
						className={cn(
							"inline-flex size-5 items-center justify-center rounded text-muted-foreground/60 transition-colors",
							"hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
						)}>
						{" "}
						<BreadcrumbEllipsis />
					</button>
				}
			/>
			<PopoverContent align="start" side="bottom" className="w-60 p-1.5">
				<div className="flex flex-col gap-0.5">
					{hidden.map((item, index) => {
						const Icon = item.icon;
						return (
							<div
								key={`${item.label}-${String(index)}`}
								className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
								<Icon className="size-3.5 shrink-0" />
								{item.href !== undefined ? (
									<span className="min-w-0 truncate text-muted-foreground hover:text-foreground">{renderLink(item)}</span>
								) : (
									<span className="font-medium text-foreground">{item.label}</span>
								)}
							</div>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** Loading placeholder — a short shimmering pill row. */
function BreadcrumbSkeleton(): React.JSX.Element {
	return (
		<div className="flex items-center gap-1.5 sm:gap-2.5" aria-hidden="true">
			<div className="h-4 w-20 animate-pulse rounded bg-muted" />
			<div className="size-3.5 text-muted-foreground/30">
				<ChevronSeparator />
			</div>
			<div className="h-4 w-28 animate-pulse rounded bg-muted" />
		</div>
	);
}

function ChevronSeparator(): React.JSX.Element {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
			<path d="m9 18 6-6-6-6" />
		</svg>
	);
}

/**
 * The dumb, presentational trail. Memoized — it only re-renders when its
 * props change (the smart consumer passes stable references).
 */
export const BreadcrumbTrail = React.memo(function BreadcrumbTrail({
	items,
	status,
	errorMessage,
	maxItems = DEFAULT_MAX_ITEMS,
	renderLink,
}: BreadcrumbTrailProps): React.JSX.Element | null {
	// Entrance animation replays whenever the trail changes: key on the last
	// crumb's label (falling back to status so loading/error animate too).
	const animationKey = React.useMemo((): string => {
		if (status === "ready" && items.length > 0) {
			const lastItem = items[items.length - 1];
			if (lastItem !== undefined) {
				return lastItem.label;
			}
		}
		return status;
	}, [items, status]);

	if (status === "loading") {
		return (
			<Breadcrumb className="group/breadcrumb mb-6">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbSkeleton />
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
		);
	}

	if (status === "error") {
		return (
			<Breadcrumb className="group/breadcrumb mb-6">
				<BreadcrumbList>
					<BreadcrumbItem>
						<span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
							<Loader2 className="size-3.5 animate-spin" />
							{errorMessage ?? "Could not load the breadcrumb trail"}
						</span>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
		);
	}

	if (items.length === 0) {
		return null;
	}

	const lastIndex = items.length - 1;
	const effectiveMax = Math.max(2, maxItems);
	const collapsed = items.length > effectiveMax;
	const leading = collapsed ? items.slice(0, 1) : [];
	const hidden = collapsed ? items.slice(1, items.length - (effectiveMax - 1)) : [];
	const tail = collapsed ? items.slice(-(effectiveMax - 1)) : items;

	const renderCrumb = (item: BreadcrumbItemData, index: number): React.JSX.Element => {
		const Icon = item.icon;
		const isLast = index === lastIndex;
		if (item.href === undefined || isLast) {
			return (
				<BreadcrumbItem key={`${item.label}-${String(index)}`}>
					<BreadcrumbPage className={cn("inline-flex min-w-0 items-center gap-1.5", isLast && "font-medium text-foreground")} title={item.label}>
						<Icon className="size-3.5 shrink-0" />
						<span className="truncate">{item.label}</span>
					</BreadcrumbPage>
				</BreadcrumbItem>
			);
		}
		return (
			<BreadcrumbItem key={`${item.label}-${String(index)}`}>
				<BreadcrumbLink
					render={renderLink(item)}
					className={cn(
						"inline-flex min-w-0 items-center gap-1.5 text-muted-foreground transition-colors",
						"hover:text-primary hover:underline hover:underline-offset-2",
						"focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
					)}
					title={item.label}>
					<Icon className="size-3.5 shrink-0" />
					<span className="truncate">{item.label}</span>
				</BreadcrumbLink>
			</BreadcrumbItem>
		);
	};

	return (
		<Breadcrumb className="group/breadcrumb mb-6">
			<BreadcrumbList>
				<div key={animationKey} className="flex min-w-0 animate-in items-center gap-1.5 duration-200 fill-mode-both fade-in slide-in-from-left-1 sm:gap-2.5">
					{leading.map((item) => (
						<React.Fragment key={`${item.label}-leading`}>
							{renderCrumb(item, 0)}
							<BreadcrumbSeparator />
						</React.Fragment>
					))}
					{collapsed && hidden.length > 0 ? (
						<React.Fragment key="ellipsis">
							<BreadcrumbItem>
								<HiddenCrumbsPopover hidden={hidden} renderLink={renderLink} />
							</BreadcrumbItem>
							<BreadcrumbSeparator />
						</React.Fragment>
					) : null}
					{tail.map((item, offset) => {
						const index = lastIndex - tail.length + 1 + offset;
						return (
							<React.Fragment key={`${item.label}-${String(index)}`}>
								{renderCrumb(item, index)}
								{index !== lastIndex ? <BreadcrumbSeparator /> : null}
							</React.Fragment>
						);
					})}
					{/* Copy-link action — appears on hover at `sm`+, always on touch */}
					<BreadcrumbItem className="ml-0.5">
						<CopyLinkButton />
					</BreadcrumbItem>
				</div>
			</BreadcrumbList>
		</Breadcrumb>
	);
});
