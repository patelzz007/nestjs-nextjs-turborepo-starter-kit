import * as React from "react";
import { StatusBadge } from "@workspace/ui/components/status-badge";

export function StatusBadgeDo1Example(): React.JSX.Element {
	return <StatusBadge tone="danger">Payment failed</StatusBadge>;
}
