"use client";

// A text input whose committed value is owned elsewhere (the URL, a store).
// It has two values: what the user is typing right now (a legitimately local
// DRAFT) and the committed value. The draft is committed after `delayMs` of
// inactivity, and is replaced during render — never in an effect — whenever
// the committed value changes from the outside (back/forward, a "clear" in
// another component, a restored preference), so the box always shows the
// committed value once the user stops typing.
//
// A commit is tracked as "pending" until the owner echoes it back, so the
// render between the commit and the owner's update never throws away
// characters typed in the meantime.

import { useCallback, useEffect, useState } from "react";

export interface DebouncedDraftOptions {
	/** The committed value as its owner holds it. */
	readonly value: string;
	/** Writes a draft to the owner. Keep it stable (`useCallback` / a store command). */
	readonly onCommit: (value: string) => void;
	/** Debounce before a typed draft is committed. */
	readonly delayMs: number;
	/**
	 * How the owner will store a draft (e.g. trimmed), so a draft that only
	 * differs by that normalization is not committed again and is not reset
	 * when its normalized echo comes back. Keep it stable (module-level).
	 */
	readonly normalize?: (draft: string) => string;
}

export interface DebouncedDraft {
	readonly draft: string;
	/** Updates the draft; it is committed after `delayMs` without further changes. */
	readonly setDraft: (draft: string) => void;
	/** Sets the draft and commits it NOW, cancelling any pending debounced commit (e.g. a clear button). */
	readonly commitNow: (draft: string) => void;
}

interface DraftSync {
	/** The committed value this draft last agreed with. */
	readonly synced: string;
	/** A committed value the owner has not echoed back yet. */
	readonly pending: string | undefined;
}

function identity(value: string): string {
	return value;
}

export function useDebouncedDraft({ value, onCommit, delayMs, normalize = identity }: DebouncedDraftOptions): DebouncedDraft {
	const [draft, setDraftState] = useState<string>(value);
	const [sync, setSync] = useState<DraftSync>({ synced: value, pending: undefined });

	// The committed value changed since the last render. Our own commit coming
	// back keeps the draft (the user may have typed more since); any other
	// change replaces it.
	if (value !== sync.synced) {
		const isOwnCommit: boolean = value === sync.pending;
		setSync({ synced: value, pending: undefined });
		if (!isOwnCommit) {
			setDraftState(value);
		}
	}

	const pending = sync.pending;
	useEffect((): (() => void) | undefined => {
		const next: string = normalize(draft);
		if (next === value || next === pending) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setSync((current: DraftSync): DraftSync => ({ synced: current.synced, pending: next }));
			onCommit(next);
		}, delayMs);
		return (): void => {
			clearTimeout(timer);
		};
	}, [delayMs, draft, normalize, onCommit, pending, value]);

	const setDraft = useCallback((next: string): void => {
		setDraftState(next);
	}, []);

	const commitNow = useCallback(
		(next: string): void => {
			// Changing the draft re-runs the effect above, whose cleanup cancels
			// the pending timer; marking the commit pending stops it re-arming.
			setDraftState(next);
			const normalized: string = normalize(next);
			if (normalized === value) {
				return;
			}
			setSync((current: DraftSync): DraftSync => ({ synced: current.synced, pending: normalized }));
			onCommit(normalized);
		},
		[normalize, onCommit, value],
	);

	return { draft, setDraft, commitNow };
}
