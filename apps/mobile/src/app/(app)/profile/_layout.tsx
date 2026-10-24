// Profile: a stack inside the Profile tab (rules/04, nested layouts) — the
// profile, then a GitHub commit opened from its commit history, and the
// GitHub pull-request screens (ADR 052) opened from the drawer.

import { Stack } from "expo-router";
import * as React from "react";

import { PUSH_TRANSITION } from "../../../lib/screen-transitions";

const SCREEN_OPTIONS = { headerShown: false, animation: PUSH_TRANSITION } satisfies React.ComponentProps<typeof Stack>["screenOptions"];

/** The profile is always the stack's first screen, even when a commit is opened directly: going back from it lands on the profile. */
const PROFILE_STACK_SETTINGS = { anchor: "index" };

// Expo Router reads the stack's settings from this exact export name.
export { PROFILE_STACK_SETTINGS as unstable_settings };

export default function ProfileLayout(): React.JSX.Element {
	return <Stack screenOptions={SCREEN_OPTIONS} />;
}
