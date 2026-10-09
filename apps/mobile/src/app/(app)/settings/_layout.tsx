// Settings: a stack inside the Settings tab (rules/04, nested layouts).

import { Stack } from "expo-router";
import * as React from "react";

const SCREEN_OPTIONS = { headerShown: false } satisfies React.ComponentProps<typeof Stack>["screenOptions"];

export default function SettingsLayout(): React.JSX.Element {
	return <Stack screenOptions={SCREEN_OPTIONS} />;
}
