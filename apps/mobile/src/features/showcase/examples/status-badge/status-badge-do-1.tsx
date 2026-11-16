import { StatusBadge } from "@workspace/ui-native/components/status-badge";
import CircleXIcon from "lucide-react-native/icons/circle-x";
import * as React from "react";

export function StatusBadgeDo1Example(): React.JSX.Element {
	return <StatusBadge tone="destructive" icon={CircleXIcon} label="Payment failed" accessibilityLabel="Payment failed" />;
}
