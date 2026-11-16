import * as React from "react";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/progress";

export function ProgressDo1Example(): React.JSX.Element {
	return (
		<Progress value={64} className="w-full max-w-xs">
			<ProgressLabel>Uploading 16 of 25 photos</ProgressLabel>
			<ProgressValue />
		</Progress>
	);
}
