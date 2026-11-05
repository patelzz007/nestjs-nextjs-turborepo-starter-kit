// ============================================
// keyboard-system-bars.ts - what the keyboard provider is told about the system bars
// ============================================
// The app draws edge to edge (Expo SDK 58 makes it mandatory on Android), so the keyboard provider
// (react-native-keyboard-controller) must treat the status bar and the navigation bar as translucent.
// It detects edge to edge itself (react-native-is-edge-to-edge) from a React Native constant that a
// development or release build sets and Expo Go does not:
//
// | Detected | Props                                        | Why                                                  |
// | yes      | none                                         | the provider forces both on; passing them is a warning in development ("… values are ignored when using react-native-edge-to-edge") |
// | no       | statusBarTranslucent, navigationBarTranslucent | left to itself it pads the whole app away from both bars, leaving page-coloured strips nothing can cover |

import { isEdgeToEdge } from "react-native-is-edge-to-edge";
import type { KeyboardProviderProps } from "react-native-keyboard-controller";

/** The keyboard provider's system-bar props. */
export type KeyboardSystemBars = Pick<KeyboardProviderProps, "statusBarTranslucent" | "navigationBarTranslucent">;

/** The system-bar props to pass, given whether the provider detects edge to edge on its own. */
export function keyboardSystemBars(edgeToEdgeDetected: boolean): KeyboardSystemBars {
	return edgeToEdgeDetected ? {} : { statusBarTranslucent: true, navigationBarTranslucent: true };
}

/** For this build, read once: whether edge to edge is detected cannot change while the app runs. */
export const KEYBOARD_SYSTEM_BARS: KeyboardSystemBars = keyboardSystemBars(isEdgeToEdge());
