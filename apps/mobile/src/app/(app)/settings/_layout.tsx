// Settings: a stack inside the Settings tab (rules/04, nested layouts).

import { Stack } from "expo-router";
import * as React from "react";

import { PUSH_TRANSITION } from "../../../lib/screen-transitions";

/**
 * `freezeOnBlur`: a screen out of sight (under the one on top, or in another tab) does not re-render
 * until it is shown again. A theme change then restyles only what is on screen at once (6.7).
 */
const SCREEN_OPTIONS = { headerShown: false, animation: PUSH_TRANSITION, freezeOnBlur: true } satisfies React.ComponentProps<typeof Stack>["screenOptions"];

/**
 * Settings is always the stack's first screen, even when a sub-screen is opened
 * directly (from the app drawer, ADR 038): going back from it lands on Settings.
 */
const SETTINGS_STACK_SETTINGS = { anchor: "index" };

// Expo Router reads the stack's settings from this exact export name.
export { SETTINGS_STACK_SETTINGS as unstable_settings };

export default function SettingsLayout(): React.JSX.Element {
	return <Stack screenOptions={SCREEN_OPTIONS} />;
}
