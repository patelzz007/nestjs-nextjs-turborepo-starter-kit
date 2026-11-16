// The toast facade: the only module screens import (ADR 023, ADR 047).
// `useToast()` confirms an action's outcome: `success("Profile saved.")`,
// `error(message)`. Every command takes options (a title, an icon or avatar,
// actions, rich content, a look, how long it stays, top or bottom) and
// returns the toast's id; `update(id, …)` rewrites a toast in place (a
// loading toast that settles), and `promise(work, messages)` shows a loading
// toast that turns into a success or an error when the work settles. The app
// shell's ToastHost shows it.

import * as React from "react";

import { createFeatureStoreContext } from "../../lib/state/feature-store-context";
import { toastActions, type ToastAction } from "./actions";
import { selectCurrentToast } from "./selectors";
import type { ToastMessage, ToastOptions, ToastState, ToastTone } from "./state";

const toastContext = createFeatureStoreContext<ToastState, ToastAction>("Toast");

export const ToastStoreProvider = toastContext.provider;

export function useCurrentToast(): ToastMessage | null {
	return toastContext.useFeatureSelector(selectCurrentToast);
}

/** A promise toast's words: while it runs, once it succeeded (from its result), and if it failed. */
export interface ToastPromiseMessages<TResult> {
	readonly loading: string;
	readonly success: (result: TResult) => string;
	readonly error: string;
}

export interface ToastCommands {
	readonly show: (tone: ToastTone, message: string, options?: ToastOptions) => number;
	readonly success: (message: string, options?: ToastOptions) => number;
	readonly error: (message: string, options?: ToastOptions) => number;
	readonly info: (message: string, options?: ToastOptions) => number;
	readonly warning: (message: string, options?: ToastOptions) => number;
	readonly loading: (message: string, options?: ToastOptions) => number;
	/** Rewrites the toast `id` in place, if it is still on show. */
	readonly update: (id: number, tone: ToastTone, message: string, options?: ToastOptions) => void;
	readonly promise: <TResult>(work: Promise<TResult>, messages: ToastPromiseMessages<TResult>, options?: ToastOptions) => Promise<TResult>;
	readonly dismissed: (id: number) => void;
}

export function useToast(): ToastCommands {
	const store = toastContext.useFeatureStore();
	const { dispatch } = store;
	return React.useMemo((): ToastCommands => {
		const show = (tone: ToastTone, message: string, options?: ToastOptions): number => {
			const id = store.api.getState().nextId;
			dispatch(toastActions.shown(tone, message, options));
			return id;
		};
		const update = (id: number, tone: ToastTone, message: string, options?: ToastOptions): void => {
			dispatch(toastActions.updated(id, tone, message, options));
		};
		return {
			show,
			success: (message: string, options?: ToastOptions): number => show("success", message, options),
			error: (message: string, options?: ToastOptions): number => show("error", message, options),
			info: (message: string, options?: ToastOptions): number => show("info", message, options),
			warning: (message: string, options?: ToastOptions): number => show("warning", message, options),
			loading: (message: string, options?: ToastOptions): number => show("loading", message, { durationMs: null, ...options }),
			update,
			promise: <TResult,>(work: Promise<TResult>, messages: ToastPromiseMessages<TResult>, options?: ToastOptions): Promise<TResult> => {
				const id = show("loading", messages.loading, { ...options, durationMs: null });
				// The toast follows the work; the caller still gets the work's own outcome.
				work.then(
					(result: TResult): void => {
						update(id, "success", messages.success(result), options);
					},
					(): void => {
						update(id, "error", messages.error, options);
					},
				);
				return work;
			},
			dismissed: (id: number): void => {
				dispatch(toastActions.dismissed(id));
			},
		};
	}, [dispatch, store]);
}
