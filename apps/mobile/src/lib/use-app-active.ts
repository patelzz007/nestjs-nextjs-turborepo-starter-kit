// Whether the app is in the foreground. Work that only matters while someone
// is looking (a ticking countdown, a re-check on return) follows it, so the
// app does nothing in the background (rules/04, app state handling).

import * as React from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Only `background` and `inactive` mean away. Before the native side's first
 * answer React Native reports `unknown` (or nothing) — the app is on screen
 * then, starting up.
 */
export function isForeground(state: AppStateStatus | null): boolean {
	return state !== "background" && state !== "inactive";
}

export function useAppActive(): boolean {
	const [isActive, setIsActive] = React.useState<boolean>((): boolean => isForeground(AppState.currentState));

	React.useEffect((): (() => void) => {
		const subscription = AppState.addEventListener("change", (next: AppStateStatus): void => {
			setIsActive(isForeground(next));
		});
		return (): void => {
			subscription.remove();
		};
	}, []);

	return isActive;
}
