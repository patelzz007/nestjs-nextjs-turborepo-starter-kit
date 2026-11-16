import * as React from "react";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/progress";

export function Progress1Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<Progress value={56}>
				<ProgressLabel>Upload progress</ProgressLabel>
				<ProgressValue />
			</Progress>
		</div>
	);
}
