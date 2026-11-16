"use client";

import * as React from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Bubble, BubbleContent, BubbleGroup } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";

// Each pickable option carries the answer it earns. One confirmation string
// shared by both would contradict whichever option it was not written for, and
// the two here ask for opposite things.
interface ReplyOption {
	readonly id: string;
	readonly label: string;
	readonly reply?: string;
	readonly href?: string;
}

const options: readonly ReplyOption[] = [
	{
		id: "retry",
		label: "Retry both invoices now",
		reply: "Queued again. INV-4417 and INV-4419 go out on the next run.",
	},
	{
		id: "hold",
		label: "Hold them until I check the addresses",
		reply: "Held. Neither invoice sends until you confirm the addresses.",
	},
	{ id: "log", label: "Open the failed invoice log", href: "#component-bubble" },
];

export function Bubble6Example(): React.JSX.Element {
	const [picked, setPicked] = useState<string | null>(null);
	const chosen = options.find((option: ReplyOption): boolean => option.id === picked);
	const handlePick = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		setPicked(event.currentTarget.dataset.optionId ?? null);
	}, []);

	return (
		<Card className="w-full max-w-sm">
			<CardContent className="flex flex-col gap-4">
				<Bubble variant="muted">
					<BubbleContent>Two invoices failed to send last night. What do you want to do?</BubbleContent>
				</Bubble>
				{chosen ? (
					<>
						<Bubble align="end">
							<BubbleContent>{chosen.label}</BubbleContent>
						</Bubble>
						{/* max-w-full lifts the 80% cap for the one bubble that carries
                controls, and it needs no `!` because a plain utility already
                outranks the style sheet. */}
						<Bubble variant="outline" className="max-w-full">
							<BubbleContent>
								{chosen.reply}
								{/* Both actions move the thread forward. Repeating the pick or
                    the link option still on offer would give the reader a row
                    of choices they have already made. */}
								<div className="mt-3 flex flex-wrap gap-2">
									<Button size="sm">Check addresses</Button>
									<Button variant="outline" size="sm">
										Notify the owner
									</Button>
								</div>
							</BubbleContent>
						</Bubble>
					</>
				) : (
					<BubbleGroup>
						{options.map((option: ReplyOption): React.JSX.Element =>
							option.href ? (
								<Bubble key={option.id} variant="tinted" align="end">
									{/* This option is an anchor and not a button, because it
                      leaves the thread instead of answering it. render keeps
                      that difference in the DOM, so middle click still works. */}
									<BubbleContent render={<a href={option.href} aria-label={option.label} />}>
										{option.label}
										<ArrowUpRightIcon aria-hidden="true" className="ms-1 inline size-4 align-text-bottom" />
									</BubbleContent>
								</Bubble>
							) : (
								<Bubble key={option.id} variant="tinted" align="end">
									{/* render turns the content element itself into the button,
                      which earns the focus ring and the hover the variant
                      already ships; a button nested inside it would get
                      neither. The visible text is the accessible name. */}
									<BubbleContent render={<button type="button" data-option-id={option.id} onClick={handlePick} />}>{option.label}</BubbleContent>
								</Bubble>
							),
						)}
					</BubbleGroup>
				)}
			</CardContent>
		</Card>
	);
}
