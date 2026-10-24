// The one way a screen, an auth page or a sheet keeps what is being typed above
// the keyboard (src/lib/keyboard-avoidance.ts says why it pads). It is
// react-native-keyboard-controller's view, not React Native's: on Android React
// Native hears of the keyboard only through the activity's window, and a sheet
// is a Modal — a window of its own, edge to edge, which the keyboard never
// resizes — so React Native's view never moved a sheet. keyboard-controller
// follows the keyboard in every window, a Modal's included (its
// `KeyboardProvider` is mounted once, in src/app/_layout.tsx).
//
// Purely structural: `variant` says whether it fills its parent (a screen, a
// sheet's window) or only wraps its content; `className` is merged last.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { KeyboardAvoidingView as KeyboardControllerAvoidingView } from "react-native-keyboard-controller";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { KEYBOARD_AVOIDING_BEHAVIOR } from "../lib/keyboard-avoidance";

/** keyboard-controller's view, with Uniwind's `className` (see screen.tsx). */
const StyledKeyboardControllerAvoidingView = withUniwind(KeyboardControllerAvoidingView);

/**
 * What the ref points at: whatever `react-native-keyboard-controller` declares. It still types the
 * ref as `View` (React Native's legacy class typing); under the strict TypeScript API React Native
 * 0.88 makes the default, that is no longer the host instance type `ViewInstance`. Follows the
 * library's declaration until it ships strict-API types.
 */
export type KeyboardAvoidingViewInstance = React.ComponentRef<typeof KeyboardControllerAvoidingView>;

export const keyboardAvoidingViewVariants = cva("", {
	variants: {
		/** `fill`: takes its parent's room (a screen, a sheet's window). `content`: as tall as what it holds. */
		variant: {
			fill: "flex-1",
			content: "",
		},
	},
	defaultVariants: { variant: "fill" },
});

export type KeyboardAvoidingViewVariant = NonNullable<VariantProps<typeof keyboardAvoidingViewVariants>["variant"]>;

export interface KeyboardAvoidingViewProps {
	readonly variant?: KeyboardAvoidingViewVariant;
	/** Extra classes, merged last (layout: `justify-end` for a sheet). */
	readonly className?: string | undefined;
	readonly children: React.ReactNode;
	readonly testID?: string | undefined;
}

export const KeyboardAvoidingView = React.memo(
	React.forwardRef<KeyboardAvoidingViewInstance, KeyboardAvoidingViewProps>(function KeyboardAvoidingView(
		{ variant = "fill", className, children, testID },
		ref,
	): React.JSX.Element {
		return (
			<StyledKeyboardControllerAvoidingView
				ref={ref}
				behavior={KEYBOARD_AVOIDING_BEHAVIOR}
				className={cn(keyboardAvoidingViewVariants({ variant }), className)}
				testID={testID}>
				{children}
			</StyledKeyboardControllerAvoidingView>
		);
	}),
);
