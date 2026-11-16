import * as React from "react";
import { Bubble, BubbleContent, BubbleGroup } from "@workspace/ui/components/bubble";

// Consecutive lines from one sender are one entry with an array of lines, not
// four separate turns. Grouping is a shape in the data first, and BubbleGroup
// is only what renders that shape.
const handoff: { id: string; from: "marco" | "you"; lines: string[] }[] = [
	{
		id: "g1",
		from: "marco",
		lines: ["Pager has been quiet since midnight.", "The retry queue drained at 02:10 and stayed at zero.", "Runbook link is in the incident, third comment down."],
	},
	{
		id: "g2",
		from: "you",
		lines: ["Thanks. Anything still open on the payments worker?"],
	},
	{
		id: "g3",
		from: "you",
		lines: ["I can pick up the backoff change this morning if nobody has started it.", "Otherwise I will watch the dashboard until standup."],
	},
	{
		id: "g4",
		from: "marco",
		lines: ["Not started, so it is yours. Ticket PLT-812."],
	},
];

export function Bubble3Example(): React.JSX.Element {
	return (
		// The group's own gap is tighter than this thread gap around it, and that
		// difference is the entire grouping signal. Equalise the two and the reader
		// sees eight unrelated messages instead of four turns.
		<div className="mx-auto flex w-full max-w-sm flex-col gap-5">
			{handoff.map((group) => (
				// align stays on each Bubble. The group stretches to the column and has
				// no side of its own, so an align passed to it would do nothing at all.
				<BubbleGroup key={group.id}>
					{/* The group is the unit one person spoke, so the name is announced
              once here rather than in front of every line inside it. */}
					<span className="sr-only">{group.from === "you" ? "You said: " : "Marco said: "}</span>
					{group.lines.map((line) => (
						<Bubble key={line} variant={group.from === "you" ? "default" : "secondary"} align={group.from === "you" ? "end" : "start"}>
							<BubbleContent>{line}</BubbleContent>
						</Bubble>
					))}
				</BubbleGroup>
			))}
			<p className="self-end text-xs text-muted-foreground">Delivered 9:41</p>
		</div>
	);
}
