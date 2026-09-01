"use client";

import { cn } from "@workspace/ui/lib/utils";
import { ChevronsRight } from "lucide-react";
import * as React from "react";

/**
 * DocsTable — the interactive table wrapper for markdown tables in guides
 * (ported from the admin docs renderer): sticky header, zebra rows, hover row
 * highlight, and a "More →" hint when the table overflows the container.
 */
export interface DocsTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
	readonly children?: React.ReactNode;
	readonly className?: string;
}

export function DocsTable({ children, className }: DocsTableProps): React.JSX.Element {
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const [canScrollRight, setCanScrollRight] = React.useState(false);

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
			<div className="border-fd-border relative overflow-hidden rounded-xl border shadow-sm">
				<div ref={scrollRef} className="overflow-x-auto overscroll-x-contain">
					<table className="[&_tbody]:bg-fd-card [&_tbody_tr:hover]:bg-fd-accent/70 [&_tbody_tr:nth-child(odd)]:bg-fd-muted/25 [&_th]:bg-fd-muted/60 [&_th]:shadow-fd-border w-full min-w-full border-collapse [&_tbody_tr]:transition-colors [&_th]:shadow-[inset_0_-1px_0] [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
						{children}
					</table>
				</div>
				<div
					aria-hidden="true"
					className={cn(
						"from-fd-card pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l to-transparent transition-opacity duration-200",
						canScrollRight ? "opacity-100" : "opacity-0",
					)}
				/>
				{canScrollRight ? (
					<div className="pointer-events-none absolute top-3 right-3">
						<span className="border-fd-border text-fd-muted-foreground bg-fd-popover/90 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shadow-sm backdrop-blur-sm">
							<ChevronsRight className="size-3" />
							More
						</span>
					</div>
				) : null}
			</div>
		</div>
	);
}

/** Table cell overrides — compact, readable cells for the docs tables. */
export function DocsTh({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
	return (
		<th className={cn("px-4 py-2.5 text-left text-[13px] font-semibold whitespace-nowrap", className)} {...props}>
			{children}
		</th>
	);
}

export function DocsTd({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
	return (
		<td className={cn("px-4 py-2.5 align-top text-[13px] leading-6 whitespace-nowrap first:font-medium", className)} {...props}>
			{children}
		</td>
	);
}
