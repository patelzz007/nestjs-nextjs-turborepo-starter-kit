import { StatusBadge } from "@workspace/ui-native/components/status-badge";
import CircleXIcon from "lucide-react-native/icons/circle-x";
import * as React from "react";

// A failure in the success tone: the colour says one thing, the words another.
export function StatusBadgeDont1Example(): React.JSX.Element {
	return <StatusBadge tone="success" icon={CircleXIcon} label="Payment failed" accessibilityLabel="Payment failed" />;
}
