"use client";

import type { KanbanPerson } from "@workspace/shared";
import { Timeline, TimelineContent, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator } from "@workspace/ui/components/timeline";
import * as React from "react";

import { KanbanPersonAvatar } from "./kanban-person";

export interface KanbanPersonTimelineProps {
	/** Names the list for screen readers ("Comments", "History"). */
	readonly label: string;
	/** How many entries it holds: every one is drawn as reached. */
	readonly count: number;
	readonly children: React.ReactNode;
}

/**
 * A list of things people did — comments, history — on the kit's `Timeline`:
 * each entry hangs off its person's avatar, joined by a line down the left.
 */
export function KanbanPersonTimeline({ label, count, children }: KanbanPersonTimelineProps): React.JSX.Element {
	return (
		<Timeline value={count} render={<ol aria-label={label} />}>
			{children}
		</Timeline>
	);
}

export interface KanbanPersonTimelineItemProps {
	/** The entry's 1-based position. */
	readonly step: number;
	readonly person: KanbanPerson;
	/** An anchor a link can jump to (a comment's "Copy link"). */
	readonly id?: string | undefined;
	readonly children: React.ReactNode;
}

/** One entry: the person's avatar on the line, the entry beside it. Avatars match the comments' size everywhere. */
export function KanbanPersonTimelineItem({ step, person, id, children }: KanbanPersonTimelineItemProps): React.JSX.Element {
	return (
		<TimelineItem
			step={step}
			id={id}
			render={<li />}
			className="scroll-mt-24 group-data-[orientation=vertical]/timeline:ms-11 group-data-[orientation=vertical]/timeline:not-last:pb-4">
			<TimelineHeader>
				<TimelineSeparator className="bg-input! group-data-[orientation=vertical]/timeline:top-2 group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-2.5rem)] group-data-[orientation=vertical]/timeline:translate-y-7" />
				<TimelineIndicator className="size-8 overflow-hidden rounded-full border-none group-data-[orientation=vertical]/timeline:-left-7">
					<KanbanPersonAvatar person={person} size="default" />
				</TimelineIndicator>
			</TimelineHeader>
			<TimelineContent className="text-foreground">{children}</TimelineContent>
		</TimelineItem>
	);
}
