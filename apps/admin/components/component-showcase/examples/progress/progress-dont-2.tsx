import * as React from "react";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/progress";

export function ProgressDont2Example(): React.JSX.Element {
	return (
		<Progress value={100} className="w-full max-w-xs **:data-[slot=progress-indicator]:bg-destructive">
			<ProgressLabel>Backup complete</ProgressLabel>
			<ProgressValue />
		</Progress>
	);
}
