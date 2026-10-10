// Haptic feedback, by intent. Screens and components ask for "a selection
// changed", never for a raw vibration, so the feel stays consistent.

import * as Haptics from "expo-haptics";

/** A light tick for a changed selection (switching tabs, picking an option). */
export function playSelectionFeedback(): void {
	Haptics.selectionAsync().catch((): void => {
		// No haptics engine (simulator, web, haptics turned off): nothing to feel.
	});
}
