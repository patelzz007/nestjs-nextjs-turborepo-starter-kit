// The toast facade: the only module screens import (ADR 023, ADR 047).
// `useToast()` confirms an action's outcome: `success("Profile saved.")`,
// `error(message)`. The app shell's ToastHost shows it under the header.

import * as React from "react";

import { createFeatureStoreContext } from "../../lib/state/feature-store-context";
import { toastActions, type ToastAction } from "./actions";
import { selectCurrentToast } from "./selectors";
import type { ToastMessage, ToastState } from "./state";

const toastContext = createFeatureStoreContext<ToastState, ToastAction>("Toast");

export const ToastStoreProvider = toastContext.provider;

export function useCurrentToast(): ToastMessage | null {
	return toastContext.useFeatureSelector(selectCurrentToast);
}

export interface ToastCommands {
	readonly success: (message: string) => void;
	readonly error: (message: string) => void;
	readonly info: (message: string) => void;
	readonly warning: (message: string) => void;
	readonly dismissed: (id: number) => void;
}

export function useToast(): ToastCommands {
	const { dispatch } = toastContext.useFeatureStore();
	return React.useMemo(
		(): ToastCommands => ({
			success: (message: string): void => {
				dispatch(toastActions.shown("success", message));
			},
			error: (message: string): void => {
				dispatch(toastActions.shown("error", message));
			},
			info: (message: string): void => {
				dispatch(toastActions.shown("info", message));
			},
			warning: (message: string): void => {
				dispatch(toastActions.shown("warning", message));
			},
			dismissed: (id: number): void => {
				dispatch(toastActions.dismissed(id));
			},
		}),
		[dispatch],
	);
}
