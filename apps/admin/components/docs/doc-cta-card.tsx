import { ArrowRight, BookOpen, Clock, PenLine } from "lucide-react";
import Link from "next/link";

import { formatIsoDate } from "@/lib/docs/markdown";
import type { DocContent } from "@/lib/docs";

/**
 * DocCtaCard — the "Continue exploring" panel shown after the prev/next
 * pager. Gives the reader a deliberate stopping point: the guide's meta
 * (author / updated / read time), a short description, and a link back to the
 * docs index. Purely presentational (rules 9–11).
 */
export interface DocCtaCardProps {
	readonly doc: DocContent;
}

export function DocCtaCard({ doc }: DocCtaCardProps): React.JSX.Element {
	return (
		<div className="mt-12 rounded-2xl border border-border/70 bg-card/60 p-6 sm:p-8">
			<p className="text-xs font-medium text-muted-foreground">Continue exploring</p>
			<h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{doc.title}</h3>
			{doc.description.length > 0 ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{doc.description}</p> : null}

			{/* Meta row — mirrors the banner, without the photo scrim */}
			<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/70 pt-4 text-xs text-muted-foreground">
				{doc.author !== undefined ? (
					<span className="inline-flex items-center gap-1.5">
						<PenLine className="size-3.5 text-muted-foreground/70" />
						{doc.author}
					</span>
				) : null}
				{doc.lastUpdated !== undefined ? (
					<span className="inline-flex items-center gap-1.5">
						<Clock className="size-3.5 text-muted-foreground/70" />
						Updated {formatIsoDate(doc.lastUpdated)}
					</span>
				) : null}
				<span className="inline-flex items-center gap-1.5">
					<BookOpen className="size-3.5 text-muted-foreground/70" />
					{doc.readingTimeMinutes} min read
				</span>
			</div>

			<Link
				href="/docs"
				className="group mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-muted/50 hover:text-primary">
				Browse all guides
				<ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
			</Link>
		</div>
	);
}
