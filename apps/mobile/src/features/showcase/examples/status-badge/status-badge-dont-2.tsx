import { StatusBadge } from "@workspace/ui-native/components/status-badge";
import WifiOffIcon from "lucide-react-native/icons/wifi-off";
import * as React from "react";

// An icon alone, named only "Icon": a screen reader user hears nothing of the state.
export function StatusBadgeDont2Example(): React.JSX.Element {
	return <StatusBadge tone="destructive" icon={WifiOffIcon} label={null} accessibilityLabel="Icon" />;
}
