import * as React from "react";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/progress";

export function Progress3Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<Progress value={70} className="**:data-[slot=progress-track]:h-3">
				<ProgressLabel>Large progress</ProgressLabel>
				<ProgressValue />
			</Progress>
		</div>
	);
}
