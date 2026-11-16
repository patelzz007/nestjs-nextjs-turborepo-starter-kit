"use client";

import * as React from "react";
import { CheckIcon, CopyIcon, RefreshCwIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard";
import { useCallback, useState } from "react";

import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import { Message, MessageContent, MessageFooter } from "@workspace/ui/components/message";

/*
 * Two drafts, because Regenerate has to return a visibly different answer to
 * teach anything. One draft and a spinner reads as a button that is broken.
 */
type Draft = readonly string[];
type Vote = "up" | "down" | null;

const FIRST_DRAFT: Draft = [
	"4.2 moves invoicing onto the new tax service, so EU orders now carry a VAT line on the PDF, the hosted receipt and the CSV export.",
	"Two smaller changes ride along: the billing portal keeps the filters you left it on, and a failed payment retries twice before it is marked overdue.",
];

const DRAFTS: readonly Draft[] = [
	FIRST_DRAFT,
	[
		"The headline in 4.2 is EU VAT. It is calculated per order rather than per account, and it shows up everywhere an amount does.",
		"We also cleared a long-standing annoyance in the billing portal: filters survive a reload, and overdue is only set after two failed retries.",
	],
];

/** How long the "copied" label shows after a copy. */
const COPIED_FEEDBACK_MS = 1600;

/*
 * A rating belongs to the answer that earned it, so regenerating clears it.
 * A thumb left lit reads as feedback on a draft nobody rated.
 */
export function Message4Example(): React.JSX.Element {
	const [draftIndex, setDraftIndex] = useState(0);
	const [vote, setVote] = useState<Vote>(null);
	const { isCopied: copied, copyToClipboard } = useCopyToClipboard({ timeout: COPIED_FEEDBACK_MS });

	const draft = DRAFTS.at(draftIndex) ?? FIRST_DRAFT;

	const handleCopy = useCallback((): void => {
		copyToClipboard(draft.join("\n\n"));
	}, [copyToClipboard, draft]);
	const handleRegenerate = useCallback((): void => {
		setDraftIndex((index: number): number => (index + 1) % DRAFTS.length);
		setVote(null);
	}, []);
	const toggleUpVote = useCallback((): void => {
		setVote((current: Vote): Vote => (current === "up" ? null : "up"));
	}, []);
	const toggleDownVote = useCallback((): void => {
		setVote((current: Vote): Vote => (current === "down" ? null : "down"));
	}, []);

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<Message align="end">
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>Summarise what changed in 4.2 for the customer note.</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>

			<Message>
				<MessageContent>
					{/*
            A ghost variant anywhere in the row drops the padding the footer
            would otherwise inherit, which sits the toolbar flush with the
            prose. aria-live carries a swapped draft to a screen reader.
          */}
					<Bubble variant="ghost" aria-live="polite">
						<BubbleContent>
							<div className="space-y-3">
								{draft.map((paragraph: string): React.JSX.Element => (
									<p key={paragraph}>{paragraph}</p>
								))}
							</div>
						</BubbleContent>
					</Bubble>
					<MessageFooter className="gap-0.5">
						<span className="pe-1 tabular-nums">09:41</span>
						{/*
              Copy is a one-shot, so it carries no aria-pressed. A pressed
              rating swaps variant, because no style tunes a colour override.
            */}
						<Button type="button" variant="ghost" size="icon-xs" aria-label={copied ? "Reply copied" : "Copy reply"} title={copied ? "Copied" : "Copy"} onClick={handleCopy}>
							{copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
						</Button>
						<Button type="button" variant="ghost" size="icon-xs" aria-label="Regenerate reply" title="Regenerate" onClick={handleRegenerate}>
							<RefreshCwIcon aria-hidden="true" />
						</Button>
						<Button
							type="button"
							variant={vote === "up" ? "secondary" : "ghost"}
							size="icon-xs"
							aria-label="Good reply"
							title="Good reply"
							aria-pressed={vote === "up"}
							onClick={toggleUpVote}>
							<ThumbsUpIcon aria-hidden="true" />
						</Button>
						<Button
							type="button"
							variant={vote === "down" ? "secondary" : "ghost"}
							size="icon-xs"
							aria-label="Bad reply"
							title="Bad reply"
							aria-pressed={vote === "down"}
							onClick={toggleDownVote}>
							<ThumbsDownIcon aria-hidden="true" />
						</Button>
					</MessageFooter>
				</MessageContent>
			</Message>
		</div>
	);
}
