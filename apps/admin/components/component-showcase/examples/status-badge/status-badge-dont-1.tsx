import * as React from "react";
import { StatusBadge } from "@workspace/ui/components/status-badge";

export function StatusBadgeDont1Example(): React.JSX.Element {
	return <StatusBadge tone="success">Payment failed</StatusBadge>;
}
