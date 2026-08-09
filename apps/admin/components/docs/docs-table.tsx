"use client";

import { ChevronsRight } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * DocsTable — the interactive table wrapper for markdown tables in guides.
 * Dumb and presentational: it receives the table children (thead/tbody/tr/…)
 * via props and adds the reading layer:
 *
 * - a **sticky header** (the thead stays visible while the table scrolls
 *   inside its container),
 * - **zebra rows** for scanability,
 * - **hover row highlight** on desktop,
 * - a **scroll affordance**: the wrapper reveals a right-edge fade + a
 *   "More →" hint chip when the table is wider than the container (common on
 *   mobile for the wide env-variable tables in the guides).
 */
export interface DocsTableProps {
	readonly children: React.ReactNode;
	readonly className?: string;
}

export function DocsTable({ children, className = "" }: DocsTableProps): React.JSX.Element {
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const [canScrollRight, setCanScrollRight] = React.useState(false);

	// Show the "More →" hint while the table overflows the container AND the
	// user hasn't scrolled to the far right yet. Re-measured on scroll/resize.
	React.useEffect(() => {
		const container = scrollRef.current;
		if (container === null) {
			return undefined;
		}
		const update = (): void => {
			setCanScrollRight(container.scrollWidth > container.clientWidth + 8 && container.scrollLeft < container.scrollWidth - container.clientWidth - 8);
		};
		update();
		const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
		observer?.observe(container);
		container.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		return (): void => {
			observer?.disconnect();
			container.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, []);

	return (
		<div className={cn("not-prose my-8", className)}>
			<div className="relative overflow-hidden rounded-xl border border-border/70">
				<div ref={scrollRef} className="overflow-x-auto overscroll-x-contain">
					{/* A REAL <table> element — react-markdown hands us the thead/tbody/tr
					    elements as children, and HTML requires them to sit inside
					    <table>. Wrapping them in a <div> (as an earlier version did)
					    made the browser emit "<thead> cannot be a child of <div>" and
					    fail hydration on every guide with a table. Sticky header,
					    zebra rows and hover highlight are applied via descendant
					    selectors on the table itself. */}
					<table className="w-full min-w-full border-collapse [&_tbody]:bg-background [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-primary/[0.05] [&_tbody_tr:nth-child(odd)]:bg-muted/20 [&_th]:bg-muted/95 [&_th]:shadow-[inset_0_-1px_0] [&_th]:shadow-border/70 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
						{children}
					</table>
				</div>
				{/* Right-edge fade + swipe hint while the table overflows */}
				<div
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-background to-transparent transition-opacity duration-200",
						canScrollRight ? "opacity-100" : "opacity-0",
					)}
				/>
				{canScrollRight ? (
					<div className="pointer-events-none absolute top-3 right-3">
						<span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
							<ChevronsRight className="size-3" />
							More
						</span>
					</div>
				) : null}
			</div>
		</div>
	);
}
