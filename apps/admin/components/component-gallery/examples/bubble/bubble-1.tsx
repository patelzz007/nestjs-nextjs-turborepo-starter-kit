import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";

// The sender is carried by the variant and the side together. Colour alone
// leaves anyone who cannot separate the two shades with an unreadable thread,
// and a side alone reads as decoration rather than as authorship.
const thread: { id: string; from: "agent" | "you"; text: string }[] = [
	{
		id: "m1",
		from: "you",
		text: "Invoice INV-4417 was charged twice on Tuesday. Can you take a look?",
	},
	{
		id: "m2",
		from: "agent",
		text: "Checking now. I can see two authorisations against INV-4417, both for $248.00.",
	},
	{
		id: "m3",
		from: "agent",
		text: "The second one was a retry after the processor timed out, so only the first should have settled.",
	},
	{
		id: "m4",
		from: "you",
		text: "That matches the bank statement. Please refund the retry.",
	},
	{
		id: "m5",
		from: "agent",
		text: "Refunded. It leaves us today and reaches your card in 3 to 5 business days.",
	},
];

export function Bubble1Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-sm">
			{/* CardHeader is a grid by default, so the flex override is what puts the
          avatar and the name on one row, and border-b is what switches on the
          header's own bottom-padding rung. */}
			<CardHeader className="flex flex-row items-center gap-3 border-b">
				<Avatar size="sm">
					<AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80" alt="Lena Ortiz" />
					<AvatarFallback>LO</AvatarFallback>
				</Avatar>
				{/* The header's gap reaches its own children, not these two, so the
            column needs a gap or the two lines render flush in every style. */}
				<div className="flex min-w-0 flex-col gap-1">
					<CardTitle>Lena Ortiz</CardTitle>
					<CardDescription>Billing support, replies in a few minutes</CardDescription>
				</div>
			</CardHeader>
			{/* align="end" resolves to align-self, so the turns have to sit in a flex
          column. In a grid or a plain block every outbound turn silently stays
          left. */}
			<CardContent className="flex flex-col gap-3">
				{thread.map((turn) => (
					<Bubble key={turn.id} align={turn.from === "you" ? "end" : "start"} variant={turn.from === "you" ? "default" : "muted"}>
						<BubbleContent>
							{/* Side and variant are both purely visual, so the turn names its
                  own sender for a reader who receives neither. */}
							<span className="sr-only">{turn.from === "you" ? "You said: " : "Lena said: "}</span>
							{turn.text}
						</BubbleContent>
					</Bubble>
				))}
			</CardContent>
		</Card>
	);
}
