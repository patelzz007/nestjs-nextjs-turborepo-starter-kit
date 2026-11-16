/**
 * The toast: one short message confirming what an action did (saved, turned
 * on, failed). Owner: this Zustand feature store, one per app shell mount
 * (ADR 047) — signing out unmounts it. Not persisted. One toast at a time: a
 * newer one replaces the one on show.
 */
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import type { ToastLook } from "@workspace/ui-native/components/toast";
import type * as React from "react";

export type ToastTone = "default" | "loading" | "success" | "info" | "warning" | "error";

/** Where a toast shows: under the header (default) or above the tab bar. */
export type ToastPosition = "top" | "bottom";

/** What a toast may carry beyond its tone and message. */
export interface ToastOptions {
	readonly title?: string | undefined;
	readonly icon?: LucideIcon | undefined;
	readonly leading?: React.ReactNode | undefined;
	readonly content?: React.ReactNode | undefined;
	readonly actions?: React.ReactNode | undefined;
	readonly look?: ToastLook | undefined;
	readonly closeButton?: boolean | undefined;
	/** How long it stays, in ms; `null` until closed. Default by tone. */
	readonly durationMs?: number | null | undefined;
	readonly position?: ToastPosition | undefined;
}

export interface ToastMessage {
	/** Tells this toast from the one it replaced: a timer only ever dismisses its own toast. */
	readonly id: number;
	readonly tone: ToastTone;
	readonly message: string;
	readonly options?: ToastOptions | undefined;
}

export interface ToastState {
	readonly current: ToastMessage | null;
	readonly nextId: number;
}

export const INITIAL_TOAST_STATE: ToastState = { current: null, nextId: 1 };
