"use client";

// ============================================
// lib/palette/focus-actions.ts - the command palette's "actions for what is on screen"
// ============================================
// A page that shows one record (a kanban item) publishes what can be done to
// it; the palette, mounted once in the shell, lists those actions above
// everything else while the page is open. One record at a time: the page that
// mounts last owns the slot, and clears it when it unmounts.

import type { LucideIcon } from "lucide-react";
import * as React from "react";

/** One action on the record in focus. */
export interface FocusAction {
	readonly id: string;
	readonly label: string;
	readonly icon: LucideIcon;
	/** Extra words the palette's search matches ("parent", "column"). */
	readonly keywords?: readonly string[] | undefined;
	readonly run: () => void;
}

/** The record in focus: what the palette's group is headed with, and its actions. */
export interface FocusActions {
	/** `STORY-142`, or a title when the record has no key. */
	readonly heading: string;
	readonly actions: readonly FocusAction[];
}

let current: FocusActions | null = null;
const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return (): void => {
		listeners.delete(listener);
	};
}

function snapshot(): FocusActions | null {
	return current;
}

function serverSnapshot(): FocusActions | null {
	return null;
}

/** Publishes `actions` while the calling component is mounted (and while `actions` is not `null`). */
export function usePublishFocusActions(actions: FocusActions | null): void {
	React.useEffect(() => {
		if (actions === null) {
			return undefined;
		}
		current = actions;
		emit();
		return (): void => {
			if (current === actions) {
				current = null;
				emit();
			}
		};
	}, [actions]);
}

/** The actions the page in focus published, or `null`. */
export function useFocusActions(): FocusActions | null {
	return React.useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** The actions whose label or keywords contain `query` (all of them for an empty query), case-insensitive. */
export function matchingFocusActions(focus: FocusActions, query: string): readonly FocusAction[] {
	const needle = query.trim().toLowerCase();
	if (needle.length === 0) {
		return focus.actions;
	}
	return focus.actions.filter((action) => [action.label, ...(action.keywords ?? [])].some((text) => text.toLowerCase().includes(needle)));
}
