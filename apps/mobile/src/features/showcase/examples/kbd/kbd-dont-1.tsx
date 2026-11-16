import { KbdGroup } from "@workspace/ui-native/components/kbd";
import * as React from "react";

const KEYS: readonly string[] = ["⌘", "K"];

export function KbdDont1Example(): React.JSX.Element {
	return <KbdGroup keys={KEYS} />;
}
