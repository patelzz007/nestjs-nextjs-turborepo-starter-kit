import Link from "next/link";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DocSummary } from "@/lib/docs";

/**
 * DocPager — "previous / next guide" navigation at the end of every article.
 * Purely presentational (rules 9–11): it receives the two neighbouring
 * `DocSummary`s via props and renders link cards. The smart layer
 * (`docs/[slug]/page.tsx`) computes the neighbours from the ordered doc list.
 *
 * The two cards mirror each other — "Previous guide" on the left, "Next
 * guide" on the right — with a soft border-card treatment: title + one-line
 * description, a directional arrow that slides on hover, and a quiet
 * border→accent transition. When only one neighbour exists (first/last
 * guide), the single card stretches across the full width.
 */

export interface DocPagerProps {
	readonly prev?: DocSummary;
	readonly next?: DocSummary;
}

export function DocPager({ prev, next }: DocPagerProps): React.JSX.Element | null {
	if (prev === undefined && next === undefined) {
		return null;
	}

	return (
		<nav aria-label="Continue reading" className="mt-14 grid gap-3 sm:grid-cols-2">
			{prev !== undefined ? (
				<Link
					href={`/docs/${prev.slug}`}
					className={cn(
						"group flex flex-col rounded-xl border border-border/70 bg-card/50 p-4 transition-all duration-200",
						"hover:border-primary/40 hover:bg-card hover:shadow-sm",
						next === undefined && "sm:col-span-2",
					)}>
					<span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
						<ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
						Previous guide
					</span>
					<span className="mt-2 truncate text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">{prev.title}</span>
					{prev.description.length > 0 ? <span className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">{prev.description}</span> : null}
				</Link>
			) : null}

			{next !== undefined ? (
				<Link
					href={`/docs/${next.slug}`}
					className={cn(
						"group flex flex-col rounded-xl border border-border/70 bg-card/50 p-4 transition-all duration-200",
						"hover:border-primary/40 hover:bg-card hover:shadow-sm",
						prev === undefined && "sm:col-span-2",
						"sm:text-right",
					)}>
					<span className="flex items-center justify-end gap-1.5 text-xs font-medium text-muted-foreground">
						Next guide
						<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
					</span>
					<span className="mt-2 truncate text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">{next.title}</span>
					{next.description.length > 0 ? <span className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">{next.description}</span> : null}
				</Link>
			) : null}
		</nav>
	);
}
