import { KbdGroup } from "@workspace/ui-native/components/kbd";
import * as React from "react";

const KEYS: readonly string[] = ["Ctrl", "Shift", "P"];

export function KbdDo2Example(): React.JSX.Element {
	return <KbdGroup keys={KEYS} accessibilityLabel="Control Shift P" />;
}
