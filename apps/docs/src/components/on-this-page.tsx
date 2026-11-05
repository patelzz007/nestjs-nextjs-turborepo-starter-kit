import { buttonVariants } from "@workspace/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet";
import { cn } from "@workspace/ui/lib/core/utils";
import { ArrowUp, ChevronDown, Link2 } from "lucide-react";
import { useCallback, useMemo, useState, type ReactElement, type RefObject } from "react";

import { useReadingProgress } from "@/hooks/use-reading-progress";
import type { TimelineItem } from "@/lib/content";
import { minutesForWords } from "@/lib/dates";
import { groupToc } from "@/lib/toc";

import { ReadingRing } from "./reading-ring";
import { TocTimeline } from "./toc-timeline";

export interface OnThisPageProps {
	readonly items: readonly TimelineItem[];
	readonly articleRef: RefObject<HTMLElement | null>;
	/** The page's total words, for the time left before the reader reaches the first section. */
	readonly words: number;
}

/** "About 6 min left" — nothing when there is nothing left to read. */
export function timeLeftLabel(wordsLeft: number): string {
	const minutes = minutesForWords(wordsLeft);
	return minutes === 0 ? "Nearly done" : `About ${String(minutes)} min left`;
}

/** Copies the URL of the current section (or the page) to the clipboard. */
async function copySectionLink(slug: string | null): Promise<void> {
	const url = new URL(window.location.href);
	url.hash = slug ?? "";
	await navigator.clipboard.writeText(url.href);
}

/**
 * "On this page": a progress ring with the time left, then the section timeline. From 1280px up it is the
 * right-hand rail; below that it is a bar under the header that opens the same timeline in a sheet. Both
 * are grid items of the article grid (`ArticlePage`), so each stays sticky for the whole article.
 */
export function OnThisPage({ items, articleRef, words }: OnThisPageProps): ReactElement | null {
	const groups = useMemo(() => groupToc(items), [items]);
	const groupItems = useMemo(
		() => groups.map((entry) => ({ ...entry.item, words: entry.children.reduce((total, child) => total + child.words, entry.item.words) })),
		[groups],
	);
	const { group, item } = useReadingProgress(articleRef, groupItems, items);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const activeSlug = item.activeSlug;
	const copy = useCallback((): void => {
		void copySectionLink(activeSlug).then(() => {
			setCopied(true);
		});
	}, [activeSlug]);
	const openSheet = useCallback((): void => {
		setSheetOpen(true);
	}, []);
	const closeSheet = useCallback((): void => {
		setSheetOpen(false);
	}, []);
	if (items.length === 0) {
		return null;
	}
	const wordsLeft = group.activeIndex < 0 ? words : group.wordsLeft;
	const current = groups[group.activeIndex]?.item.text ?? "Introduction";

	return (
		<>
			<aside
				aria-label="On this page"
				className="sticky top-[calc(var(--header-height)+1.5rem)] hidden max-h-[calc(100dvh-var(--header-height)-3rem)] self-start overflow-y-auto pt-6 pb-6 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:block">
				<div className="flex items-center gap-3 border-b border-border pb-3.5">
					<ReadingRing percent={group.percent} size={44} />
					<p className="grid text-xs text-muted-foreground">
						<span className="text-sm font-semibold text-foreground">{group.percent}% read</span>
						{timeLeftLabel(wordsLeft)}
					</p>
				</div>
				<h2 className="sr-only">On this page</h2>
				<div className="pt-3.5">
					<TocTimeline groups={groups} group={group} item={item} />
				</div>
				<div className="mt-4 flex flex-wrap gap-2">
					<button type="button" onClick={copy} className={cn(buttonVariants({ variant: "outline", size: "xs" }), "rounded-full")}>
						<Link2 aria-hidden="true" />
						{copied ? "Link copied" : "Copy link"}
					</button>
					<a href="#main-content" className={cn(buttonVariants({ variant: "outline", size: "xs" }), "rounded-full")}>
						<ArrowUp aria-hidden="true" />
						Top
					</a>
				</div>
			</aside>
			<div className="docs-glass sticky top-(--header-height) z-30 col-start-1 row-start-1 -mx-4 self-start border-b border-border md:-mx-6 xl:hidden">
				<button
					type="button"
					onClick={openSheet}
					aria-label={`On this page: ${current}. ${timeLeftLabel(wordsLeft)}.`}
					className="flex min-h-12 w-full items-center gap-2.5 px-4 text-left text-sm md:px-6">
					<ReadingRing percent={group.percent} size={22} />
					<span className="min-w-0 flex-1 truncate font-medium">{current}</span>
					<span className="shrink-0 text-xs text-muted-foreground tabular-nums">{timeLeftLabel(wordsLeft)}</span>
					<ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
				</button>
				<span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-border">
					<span className="block h-full bg-(--docs-link)" style={{ width: `${String(group.percent)}%` }} />
				</span>
			</div>
			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
				<SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
					<SheetHeader>
						<SheetTitle>On this page</SheetTitle>
						<SheetDescription>
							{group.percent}% read · {timeLeftLabel(wordsLeft)}
						</SheetDescription>
					</SheetHeader>
					<div className="px-4 pb-6">
						<TocTimeline groups={groups} group={group} item={item} onNavigate={closeSheet} />
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
}
