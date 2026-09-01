"use client";

import { Check, Copy, LinkIcon, Loader2 } from "lucide-react";
import * as React from "react";
import { memo, useCallback, useMemo } from "react";

import { Button } from "@workspace/ui/components/form/button";
import {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/navigation/breadcrumb";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/overlay/popover";
import type { BreadcrumbItem as BreadcrumbItemData, BreadcrumbStatus } from "@workspace/ui/components/navigation/breadcrumb-context";
import { cn } from "@workspace/ui/lib/utils";

// ════════════════════════════════════════════════════════════════════════════
// BreadcrumbTrail — memoized, presentational trail.
//
// It knows nothing about routing or menus — it receives the resolved crumbs
// via props and renders them with **mandatory icons** on every crumb (rule 9:
// data arrives from the smart consumer; `renderLink` is app-supplied so this
// package never imports `next/link`).
//
// Rendering features:
// - `maxItems` collapse: the first crumb + the last `maxItems - 1` are shown;
//   the hidden middle becomes a **popover** listing every hidden crumb.
// - A **copy-link** button after the last crumb (hover at `sm`+, always on
//   touch) that copies the current page URL and announces the result via a
//   visually-hidden `role="status"` region; `onCopy` lets the smart layer
//   show a toast (feature — copy feedback).
// - A light **entrance animation** (`motion-safe:` — respects
//   `prefers-reduced-motion`) that replays on trail changes.
// - **Status placeholders**: `loading` renders a skeleton, `error` a
//   `role="status"` message with an optional `onRetry` action.
// - Custom `separator`, `size` (sm/default) and `scrollable` props for dense
//   page chrome and single-line header mode.
// ════════════════════════════════════════════════════════════════════════════

export interface BreadcrumbTrailProps {
	readonly items: readonly BreadcrumbItemData[];
	/** Derived from the shared status union so it can't drift (improvement 18). */
	readonly status: BreadcrumbStatus["kind"];
	/** Error-state copy — overridable for i18n (improvement 20). @default "Could not load the breadcrumb trail" */
	readonly errorMessage?: string;
	/** Collapse threshold — defaults to 4 (first + ellipsis + last 3). Pass 2 for a compact mobile trail. */
	readonly maxItems?: number;
	/** App-supplied link renderer (e.g. a Next.js `Link`) — returns the bare link element the crumb wraps. */
	readonly renderLink: (item: BreadcrumbItemData) => React.ReactElement;
	/** Compact density for dense page chrome (feature — compact). @default "default" */
	readonly size?: "sm" | "default";
	/** Single-line `overflow-x-auto` mode for page headers with many crumbs (improvement 3). @default false */
	readonly scrollable?: boolean;
	/** Custom separator node shared by every crumb (feature — branded separators). */
	readonly separator?: React.ReactNode;
	/** Rendered under the error message — a retry affordance (improvement 11). */
	readonly onRetry?: () => void;
	/** Fired after a copy attempt with the result — the smart layer wires the toast (feature — copy feedback). */
	readonly onCopy?: (ok: boolean) => void;
}

const DEFAULT_MAX_ITEMS = 4;
const DEFAULT_ERROR_MESSAGE = "Could not load the breadcrumb trail";

/** Last element of a non-empty trail, without repeated `items[items.length - 1]` indexing (improvement 6). */
function lastOf(items: readonly BreadcrumbItemData[]): BreadcrumbItemData | undefined {
	return items[items.length - 1];
}

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

export interface CopyLinkButtonProps {
	/** Fired after a copy attempt with the result (smart layer wires the toast). */
	readonly onCopy?: (ok: boolean) => void;
}

/**
 * Copy-link button: appears on hover at `sm`+, always visible on touch, with a
 * transient "copied" state and a visually-hidden `role="status"` region that
 * announces the outcome (improvements 2/16). Ref-forwarded for tooltip/focus
 * tests (improvement 1).
 */
const CopyLinkButton = React.forwardRef<HTMLButtonElement, CopyLinkButtonProps>(function CopyLinkButton({ onCopy }, ref): React.JSX.Element {
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

	const handleCopy = useCallback((): void => {
		if (timeoutRef.current !== null) {
			window.clearTimeout(timeoutRef.current);
		}
		void copyCurrentUrl().then((ok: boolean): void => {
			setCopied(ok);
			setFailed(!ok);
			onCopy?.(ok);
			timeoutRef.current = window.setTimeout(() => {
				setCopied(false);
				setFailed(false);
				timeoutRef.current = null;
			}, 2000);
		});
	}, [onCopy]);

	return (
		<Button
			ref={ref}
			type="button"
			variant="ghost"
			size="icon-xs"
			onClick={handleCopy}
			aria-label="Copy link to this page"
			title={failed ? "Could not copy — selected address bar manually" : "Copy link to this page"}
			className={cn(
				"text-muted-foreground/50",
				"hover:bg-muted hover:text-foreground",
				copied ? "text-success" : failed ? "text-destructive" : "sm:opacity-0 sm:group-hover/breadcrumb:opacity-100 sm:focus-visible:opacity-100",
			)}>
			{copied ? <Check className="size-3.5" /> : failed ? <Copy className="size-3.5" /> : <LinkIcon className="size-3.5" />}
			<span className="sr-only" role="status">
				{copied ? "Link copied" : failed ? "Could not copy link" : ""}
			</span>
		</Button>
	);
});

interface HiddenCrumbsPopoverProps {
	readonly hidden: readonly BreadcrumbItemData[];
	readonly renderLink: (item: BreadcrumbItemData) => React.ReactElement;
}

/** Popover listing the hidden (collapsed) crumbs as links — memoized (improvement 9). */
const HiddenCrumbsPopover = memo(function HiddenCrumbsPopover({ hidden, renderLink }: HiddenCrumbsPopoverProps): React.JSX.Element {
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						aria-label="More breadcrumbs"
						title="Show all breadcrumbs"
						className="min-h-8 min-w-8 text-muted-foreground/60 hover:bg-muted hover:text-foreground">
						<BreadcrumbEllipsis />
					</Button>
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
									<span className="min-w-0 truncate text-muted-foreground hover:text-foreground">
										{/* `renderLink` returns the app's BARE link element (base-ui `render`
									    pattern — the trail's `BreadcrumbLink` injects the label as its
									    children, which this popover doesn't do). Inject the label so
									    hidden crumbs show their text, not just an icon. */}
										{React.cloneElement(renderLink(item), undefined, item.label)}
									</span>
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
});

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
 * props change; consumers must pass stable `items`/`renderLink` references for
 * the memo to pay off (improvement 17).
 */
export const BreadcrumbTrail = React.memo(function BreadcrumbTrail({
	items,
	status,
	errorMessage = DEFAULT_ERROR_MESSAGE,
	maxItems = DEFAULT_MAX_ITEMS,
	renderLink,
	size,
	scrollable = false,
	separator,
	onRetry,
	onCopy,
}: BreadcrumbTrailProps): React.JSX.Element | null {
	// Entrance animation replays whenever the trail changes: key on the href
	// path when present (two trails ending in the same label — e.g. two
	// "Settings" pages — still re-animate), falling back to the label, then to
	// the status so loading/error animate too (improvement 3).
	const animationKey = useMemo((): string => {
		if (status === "ready" && items.length > 0) {
			const lastItem = lastOf(items);
			if (lastItem !== undefined) {
				if (lastItem.href !== undefined) {
					return items.map((item) => item.href ?? item.label).join("/");
				}
				return lastItem.label;
			}
		}
		return status;
	}, [items, status]);

	if (status === "loading") {
		return (
			<Breadcrumb className="group/breadcrumb mb-6">
				<BreadcrumbList size={size} scrollable={scrollable}>
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
				<BreadcrumbList size={size} scrollable={scrollable}>
					<BreadcrumbItem>
						{/* `role="status"` announces the failure politely (improvement 12). */}
						<span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
							<Loader2 className="size-3.5 animate-spin" />
							{errorMessage}
							{onRetry !== undefined ? (
								<Button
									type="button"
									variant="link"
									size="sm"
									onClick={onRetry}
									className="h-auto p-0 font-medium text-foreground no-underline hover:text-primary hover:underline">
									Retry
								</Button>
							) : null}
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
			<BreadcrumbList size={size} scrollable={scrollable}>
				{/* `motion-safe:` — the entrance animation is skipped for users who
				    prefer reduced motion (improvement 13). */}
				<div
					key={animationKey}
					className="flex min-w-0 items-center gap-1.5 motion-safe:animate-in motion-safe:duration-200 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-left-1 sm:gap-2.5">
					{leading.map((item) => (
						<React.Fragment key={`${item.label}-leading`}>
							{renderCrumb(item, 0)}
							<BreadcrumbSeparator>{separator}</BreadcrumbSeparator>
						</React.Fragment>
					))}
					{collapsed && hidden.length > 0 ? (
						<React.Fragment key="ellipsis">
							<BreadcrumbItem>
								<HiddenCrumbsPopover hidden={hidden} renderLink={renderLink} />
							</BreadcrumbItem>
							<BreadcrumbSeparator>{separator}</BreadcrumbSeparator>
						</React.Fragment>
					) : null}
					{tail.map((item, offset) => {
						const index = lastIndex - tail.length + 1 + offset;
						return (
							<React.Fragment key={`${item.label}-${String(index)}`}>
								{renderCrumb(item, index)}
								{index !== lastIndex ? <BreadcrumbSeparator>{separator}</BreadcrumbSeparator> : null}
							</React.Fragment>
						);
					})}
					{/* Copy-link action — appears on hover at `sm`+, always on touch;
					    hidden entirely when printing (feature — print support). */}
					<BreadcrumbItem className="ml-0.5 print:hidden">
						<CopyLinkButton onCopy={onCopy} />
					</BreadcrumbItem>
				</div>
			</BreadcrumbList>
		</Breadcrumb>
	);
});
