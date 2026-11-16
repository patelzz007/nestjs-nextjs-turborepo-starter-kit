import { KbdGroup } from "@workspace/ui-native/components/kbd";
import * as React from "react";

const CHORD: readonly string[] = ["Ctrl", "Shift", "P"];

export function Kbd2Example(): React.JSX.Element {
	return <KbdGroup keys={CHORD} accessibilityLabel="Control Shift P" />;
}
