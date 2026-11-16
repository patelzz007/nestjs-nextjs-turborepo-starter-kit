import * as React from "react";
import { Progress } from "@workspace/ui/components/progress";

export function FileUploadDo2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-2 rounded-lg border border-border p-3">
			<div className="flex justify-between text-sm">
				<span className="truncate">site-survey.mp4</span>
				<span className="text-muted-foreground tabular-nums">64%</span>
			</div>
			<Progress value={64} aria-label="Uploading site-survey.mp4" />
		</div>
	);
}
