import * as React from "react";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/progress";

export function Progress2Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<Progress value={30} className="**:data-[slot=progress-track]:h-1">
				<ProgressLabel>Small progress</ProgressLabel>
				<ProgressValue />
			</Progress>
		</div>
	);
}
