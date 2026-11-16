import * as React from "react";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { WifiOffIcon } from "lucide-react";

export function StatusBadgeDo2Example(): React.JSX.Element {
	return (
		<StatusBadge tone="muted" aria-label="Offline">
			<WifiOffIcon aria-hidden="true" />
		</StatusBadge>
	);
}
