import { StatusBadge } from "@workspace/ui-native/components/status-badge";
import WifiOffIcon from "lucide-react-native/icons/wifi-off";
import * as React from "react";

export function StatusBadgeDo2Example(): React.JSX.Element {
	return <StatusBadge tone="destructive" icon={WifiOffIcon} label={null} accessibilityLabel="Offline" />;
}
