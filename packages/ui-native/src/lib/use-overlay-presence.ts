// An overlay's presence (a sheet, a picker, the scanner): one animated value, 0 hidden to 1 shown,
// that the backdrop and the panel both read, so they arrive and leave together. The overlay stays
// presented (its Modal up) until that value has fully run out, then unmounts. A Modal's own
// "slide" moves its whole window, the dimmed backdrop with it, so the backdrop would slide away
// like a curtain instead of fading with the panel; overlays use `animationType="none"` and this.
//
// Each opening is counted: reopening while the last one is still leaving starts a fresh opening,
// and a leave that finishes late (the end reaches the JS thread after the animation) closes only
// its own opening, never the one that replaced it.

import * as React from "react";
import { useSharedValue, withTiming, type SharedValue, type WithTimingConfig } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/** How the overlay comes in and goes out. Both follow the OS Reduce Motion setting (see lib/motion). */
export interface OverlayMotion {
	readonly enter: WithTimingConfig;
	readonly exit: WithTimingConfig;
}

export const OVERLAY_HIDDEN = 0;
export const OVERLAY_SHOWN = 1;

export interface OverlayPresence {
	/** Keep the overlay (its Modal) up: shown, or still leaving. */
	readonly presented: boolean;
	/** Which opening this is: key the overlay's content on it so each opening starts fresh. */
	readonly opening: number;
	/** 0 hidden → 1 shown: drive the backdrop's opacity and the panel's movement from it. */
	readonly progress: SharedValue<number>;
}

interface PresenceState {
	readonly opening: number;
	readonly presented: boolean;
}

export function useOverlayPresence(visible: boolean, motion: OverlayMotion): OverlayPresence {
	const [presence, setPresence] = React.useState<PresenceState>({ opening: 0, presented: visible });
	const [wasVisible, setWasVisible] = React.useState(visible);
	// Opened: present a fresh opening (adjusting state during render, React's documented pattern).
	if (visible !== wasVisible) {
		setWasVisible(visible);
		if (visible) {
			setPresence((current: PresenceState): PresenceState => ({ opening: current.opening + 1, presented: true }));
		}
	}

	const progress = useSharedValue(visible ? OVERLAY_SHOWN : OVERLAY_HIDDEN);
	const finishLeaving = React.useCallback((leftOpening: number): void => {
		setPresence((current: PresenceState): PresenceState => (current.opening === leftOpening ? { ...current, presented: false } : current));
	}, []);
	const { opening } = presence;
	const { enter, exit } = motion;
	React.useEffect((): void => {
		if (visible) {
			progress.set(withTiming(OVERLAY_SHOWN, enter));
			return;
		}
		progress.set(
			withTiming(OVERLAY_HIDDEN, exit, (finished?: boolean): void => {
				"worklet";
				if (finished === true) {
					scheduleOnRN(finishLeaving, opening);
				}
			}),
		);
	}, [enter, exit, finishLeaving, opening, progress, visible]);

	return { presented: presence.presented, opening, progress };
}
