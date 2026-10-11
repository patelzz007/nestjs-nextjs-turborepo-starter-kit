/**
 * The toast: one short message confirming what an action did (saved, turned
 * on, failed). Owner: this Zustand feature store, one per app shell mount
 * (ADR 047) — signing out unmounts it. Not persisted. One toast at a time: a
 * newer one replaces the one on show.
 */
export type ToastTone = "success" | "info" | "warning" | "error";

export interface ToastMessage {
	/** Tells this toast from the one it replaced: a timer only ever dismisses its own toast. */
	readonly id: number;
	readonly tone: ToastTone;
	readonly message: string;
}

export interface ToastState {
	readonly current: ToastMessage | null;
	readonly nextId: number;
}

export const INITIAL_TOAST_STATE: ToastState = { current: null, nextId: 1 };
