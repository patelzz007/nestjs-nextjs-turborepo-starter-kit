"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback, useState, useSyncExternalStore } from "react";

import { usePathname } from "next/navigation";

type Feedback = "up" | "down";

const STORAGE_PREFIX = "docs:feedback:";

/** Reads the persisted vote for a page; `null` on the server. */
function readVote(storageKey: string): Feedback | null {
	if (typeof window === "undefined") {
		return null;
	}
	const stored: string | null = window.localStorage.getItem(storageKey);
	return stored === "up" || stored === "down" ? stored : null;
}

function subscribe(onStoreChange: () => void): () => void {
	window.addEventListener("storage", onStoreChange);
	return (): void => {
		window.removeEventListener("storage", onStoreChange);
	};
}

/**
 * "Was this helpful?" widget shown in the docs page footer. The vote persists
 * per-URL in `localStorage`, seeded hydration-safely via `useSyncExternalStore`
 * (no setState-in-effect) and overridable within the session. No backend —
 * votes are the reader's own signal; wire them to analytics later if needed.
 */
export function WasThisHelpful(): React.JSX.Element {
	const pathname = usePathname();
	const storageKey = `${STORAGE_PREFIX}${pathname}`;
	const [sessionVote, setSessionVote] = useState<Feedback | null>(null);

	const persistedVote: Feedback | null = useSyncExternalStore(
		subscribe,
		(): Feedback | null => readVote(storageKey),
		(): Feedback | null => null,
	);

	const vote: Feedback | null = sessionVote ?? persistedVote;

	const handleVote = useCallback(
		(value: Feedback): void => {
			setSessionVote(value);
			window.localStorage.setItem(storageKey, value);
		},
		[storageKey],
	);
	const voteUp = useCallback((): void => {
		handleVote("up");
	}, [handleVote]);
	const voteDown = useCallback((): void => {
		handleVote("down");
	}, [handleVote]);

	return (
		<div className="mt-10 flex flex-col items-center gap-3 border-t pt-8 text-sm">
			<p className="text-fd-muted-foreground font-medium">Was this helpful?</p>
			{vote === null ? (
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={voteUp}
						className="text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 font-medium transition-colors">
						<ThumbsUp className="size-4" />
						Yes
					</button>
					<button
						type="button"
						onClick={voteDown}
						className="text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 font-medium transition-colors">
						<ThumbsDown className="size-4" />
						No
					</button>
				</div>
			) : (
				<p className="text-fd-muted-foreground">{vote === "up" ? "Thanks — glad it helped!" : "Thanks for the feedback — we'll take a look."}</p>
			)}
		</div>
	);
}
