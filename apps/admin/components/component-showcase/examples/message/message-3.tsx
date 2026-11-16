import * as React from "react";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Message, MessageContent, MessageFooter, MessageHeader } from "@workspace/ui/components/message";

/*
 * The two metadata slots pick their side differently: MessageHeader stays
 * where the content starts whatever the row does, while MessageFooter follows
 * the row to the end. Both inherit the bubble's horizontal padding.
 */
export function Message3Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-7">
			<Message>
				<MessageContent>
					{/*
            The primitive ships no gap, so a header built from more than one
            node supplies its own. The separator is a decorative dot rather than a
            typographic interpunct, and aria-hidden so the row is announced as
            "Emma Wilson 09:38".
          */}
					<MessageHeader className="gap-1.5">
						Emma Wilson
						<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
						<span className="tabular-nums">09:38</span>
					</MessageHeader>
					<Bubble variant="muted">
						<BubbleContent>The invoice template is missing the VAT line on EU orders.</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>

			<Message align="end">
				<MessageContent>
					<Bubble>
						<BubbleContent>Fixed on the 4.2 branch. It ships with tonight&apos;s release.</BubbleContent>
					</Bubble>
					<MessageFooter>Read 09:41</MessageFooter>
				</MessageContent>
			</Message>

			<Message>
				<MessageContent>
					<MessageHeader className="gap-1.5">
						Emma Wilson
						<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
						<span className="tabular-nums">09:42</span>
					</MessageHeader>
					<Bubble variant="muted">
						<BubbleContent>Then I will re-run the January batch once it is out.</BubbleContent>
					</Bubble>
					<MessageFooter className="gap-1.5">
						<span>Edited</span>
						<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
						<span className="tabular-nums">09:44</span>
					</MessageFooter>
				</MessageContent>
			</Message>
		</div>
	);
}
