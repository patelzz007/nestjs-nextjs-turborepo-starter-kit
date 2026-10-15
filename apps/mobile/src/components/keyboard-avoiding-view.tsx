// The one way a screen, an auth page or a sheet keeps what is being typed above
// the keyboard (src/lib/keyboard-avoidance.ts says why it pads). It is
// react-native-keyboard-controller's view, not React Native's: on Android React
// Native hears of the keyboard only through the activity's window, and a sheet
// is a Modal — a window of its own, edge to edge, which the keyboard never
// resizes — so React Native's view never moved a sheet. keyboard-controller
// follows the keyboard in every window, a Modal's included (its
// `KeyboardProvider` is mounted once, in src/app/_layout.tsx).

import * as React from "react";
import { KeyboardAvoidingView as KeyboardControllerAvoidingView } from "react-native-keyboard-controller";
import { withUniwind } from "uniwind";

import { KEYBOARD_AVOIDING_BEHAVIOR } from "../lib/keyboard-avoidance";

/** keyboard-controller's view, with Uniwind's `className` (see screen.tsx). */
const StyledKeyboardControllerAvoidingView = withUniwind(KeyboardControllerAvoidingView);

export interface KeyboardAvoidingViewProps {
	readonly className: string;
	readonly children: React.ReactNode;
	readonly testID?: string | undefined;
}

export function KeyboardAvoidingView({ className, children, testID }: KeyboardAvoidingViewProps): React.JSX.Element {
	return (
		<StyledKeyboardControllerAvoidingView behavior={KEYBOARD_AVOIDING_BEHAVIOR} className={className} testID={testID}>
			{children}
		</StyledKeyboardControllerAvoidingView>
	);
}
