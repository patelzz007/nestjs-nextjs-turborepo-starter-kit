import { Button } from "@workspace/ui/components/button";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback, useSyncExternalStore, type ReactElement } from "react";
import { z } from "zod";

export const FEEDBACK_STORAGE_PREFIX = "docs:feedback:";
/** Fired on `window` when this page stores a vote (the `storage` event only reaches other tabs). */
const VOTE_EVENT = "docs:feedback-vote";
const VoteSchema = z.enum(["yes", "no"]);
type Vote = z.output<typeof VoteSchema>;

export function readVote(path: string): Vote | null {
	try {
		const vote = VoteSchema.safeParse(window.localStorage.getItem(`${FEEDBACK_STORAGE_PREFIX}${path}`));
		return vote.success ? vote.data : null;
	} catch {
		return null;
	}
}

function writeVote(path: string, vote: Vote): void {
	try {
		window.localStorage.setItem(`${FEEDBACK_STORAGE_PREFIX}${path}`, vote);
	} catch {
		// Storage unavailable: the vote is not remembered.
	}
	window.dispatchEvent(new Event(VOTE_EVENT));
}

function subscribe(onChange: () => void): () => void {
	window.addEventListener("storage", onChange);
	window.addEventListener(VOTE_EVENT, onChange);
	return (): void => {
		window.removeEventListener("storage", onChange);
		window.removeEventListener(VOTE_EVENT, onChange);
	};
}

function noVoteOnTheServer(): Vote | null {
	return null;
}

export interface FeedbackProps {
	/** The page the vote belongs to. */
	readonly path: string;
}

/** "Was this page helpful?" — remembered per page in this browser only; nothing is sent anywhere. */
export function Feedback({ path }: FeedbackProps): ReactElement {
	const getVote = useCallback((): Vote | null => readVote(path), [path]);
	const vote = useSyncExternalStore(subscribe, getVote, noVoteOnTheServer);
	const voteYes = useCallback((): void => {
		writeVote(path, "yes");
	}, [path]);
	const voteNo = useCallback((): void => {
		writeVote(path, "no");
	}, [path]);

	return (
		<section aria-label="Feedback" className="mt-12 flex flex-wrap items-center gap-3 border-t border-border pt-6 text-sm">
			<p className="font-medium">Was this page helpful?</p>
			<div className="flex gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-pressed={vote === "yes"}
					onClick={voteYes}
					className="aria-pressed:border-(--docs-link) aria-pressed:text-(--docs-link)">
					<ThumbsUp aria-hidden="true" />
					Yes
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-pressed={vote === "no"}
					onClick={voteNo}
					className="aria-pressed:border-(--docs-link) aria-pressed:text-(--docs-link)">
					<ThumbsDown aria-hidden="true" />
					No
				</Button>
			</div>
			<p role="status" className="text-muted-foreground">
				{vote === null ? "" : "Thanks, noted for this browser."}
			</p>
		</section>
	);
}
