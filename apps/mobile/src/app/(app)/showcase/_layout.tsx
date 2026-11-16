// The component showcase: a stack (the index, then a component's screen and its docs) — rules/04, nested layouts.

import { Stack } from "expo-router";
import * as React from "react";

import { PUSH_TRANSITION } from "../../../lib/screen-transitions";

/** `freezeOnBlur`: a screen out of sight does not re-render until it is shown again (the Settings stack's options). */
const SCREEN_OPTIONS = { headerShown: false, animation: PUSH_TRANSITION, freezeOnBlur: true } satisfies React.ComponentProps<typeof Stack>["screenOptions"];

/** The index is always the stack's first screen, even when a component is opened directly (a link): going back lands on it. */
const SHOWCASE_STACK_SETTINGS = { anchor: "index" };

// Expo Router reads the stack's settings from this exact export name.
export { SHOWCASE_STACK_SETTINGS as unstable_settings };

export default function ShowcaseLayout(): React.JSX.Element {
	return <Stack screenOptions={SCREEN_OPTIONS} />;
}
