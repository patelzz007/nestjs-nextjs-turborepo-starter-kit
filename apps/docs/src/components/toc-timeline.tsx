import { cn } from "@workspace/ui/lib/core/utils";
import type { CSSProperties, ReactElement } from "react";

import type { TimelineItem } from "@/lib/content";
import { minutesForWords } from "@/lib/dates";
import type { ReadingState } from "@/lib/reading-progress";
import type { TocGroup } from "@/lib/toc";

export interface TocTimelineProps {
	readonly groups: readonly TocGroup<TimelineItem>[];
	readonly group: ReadingState;
	readonly item: ReadingState;
	/** Called after an entry is picked (the phone sheet closes itself). */
	readonly onNavigate?: () => void;
}

type NodeState = "read" | "current" | "upcoming";

function nodeState(index: number, activeIndex: number): NodeState {
	if (index < activeIndex) return "read";
	return index === activeIndex ? "current" : "upcoming";
}

/** How much of the track below a node is filled: full when read, partly in the current section. */
function trackFill(state: NodeState, withinActive: number): string {
	if (state === "read") return "100%";
	return state === "current" ? `${String(Math.round(withinActive * 100))}%` : "0%";
}

function groupWords(entry: TocGroup<TimelineItem>): number {
	return entry.children.reduce((total, child) => total + child.words, entry.item.words);
}

/**
 * The "On this page" timeline: one node per section on a single track, filled up to where the reader is.
 * Every node is the same size; read sections are filled, the current one is a ring, upcoming ones are
 * hollow. Subsections hang from their section on a rule, like the app sidebars' nested items.
 */
export function TocTimeline({ groups, group, item, onNavigate }: TocTimelineProps): ReactElement {
	return (
		<ol className="toc-timeline text-[0.8125rem]">
			{groups.map((entry, index) => {
				const state = nodeState(index, group.activeIndex);
				const isCurrent = state === "current";
				const minutes = minutesForWords(groupWords(entry));
				const fill: CSSProperties = { "--toc-fill": trackFill(state, group.withinActive) };
				return (
					<li key={entry.item.slug} data-state={state} style={fill}>
						<span className="toc-node" aria-hidden="true" />
						<a
							href={`#${entry.item.slug}`}
							onClick={onNavigate}
							aria-current={isCurrent ? "location" : undefined}
							className={cn(
								"block leading-snug transition-colors hover:text-foreground",
								isCurrent ? "font-semibold text-foreground" : state === "read" ? "text-(--docs-text-secondary)" : "text-muted-foreground",
							)}>
							{entry.item.text}
						</a>
						{isCurrent && minutes > 0 ? (
							<p className="mt-1.5 mb-0.5 rounded-md bg-(--docs-sel-soft) px-2.5 py-1.5 text-xs leading-snug text-(--docs-text-secondary)">
								About <span className="font-medium text-(--docs-link)">{minutes} min</span> in this section
							</p>
						) : null}
						{entry.children.length > 0 ? (
							<ol className="toc-kids">
								{entry.children.map((child) => (
									<li key={child.slug}>
										<a
											href={`#${child.slug}`}
											onClick={onNavigate}
											aria-current={child.slug === item.activeSlug ? "location" : undefined}
											className={cn(
												"block py-0.5 text-xs leading-snug transition-colors hover:text-foreground",
												child.slug === item.activeSlug ? "font-medium text-foreground" : "text-muted-foreground",
											)}>
											{child.text}
										</a>
									</li>
								))}
							</ol>
						) : null}
					</li>
				);
			})}
		</ol>
	);
}
