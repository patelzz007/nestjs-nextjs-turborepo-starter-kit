import * as React from "react";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { WifiOffIcon } from "lucide-react";

export function StatusBadgeDont2Example(): React.JSX.Element {
	return (
		<StatusBadge tone="muted" aria-label="Wi-Fi icon with a slash">
			<WifiOffIcon aria-hidden="true" />
		</StatusBadge>
	);
}
