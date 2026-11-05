import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ReactElement } from "react";

import type { PageLink } from "@/lib/content";

import { HrefLink } from "./href-link";

export interface PagerProps {
	readonly previous: PageLink | null;
	readonly next: PageLink | null;
}

const CARD =
	"group grid gap-1 rounded-lg border border-border bg-(--docs-chrome) px-4 py-3 transition-colors hover:border-(--docs-link) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Previous / next page in reading order. */
export function Pager({ previous, next }: PagerProps): ReactElement | null {
	if (previous === null && next === null) {
		return null;
	}
	return (
		<nav aria-label="Previous and next" className="mt-8 grid gap-3 sm:grid-cols-2">
			{previous === null ? (
				<span />
			) : (
				<HrefLink href={previous.href} className={CARD}>
					<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<ArrowLeft aria-hidden="true" className="size-3.5" />
						Previous
					</span>
					<span className="font-medium group-hover:text-(--docs-link)">{previous.title}</span>
				</HrefLink>
			)}
			{next === null ? null : (
				<HrefLink href={next.href} className={`${CARD} sm:text-right`}>
					<span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:justify-end">
						Next
						<ArrowRight aria-hidden="true" className="size-3.5" />
					</span>
					<span className="font-medium group-hover:text-(--docs-link)">{next.title}</span>
				</HrefLink>
			)}
		</nav>
	);
}
