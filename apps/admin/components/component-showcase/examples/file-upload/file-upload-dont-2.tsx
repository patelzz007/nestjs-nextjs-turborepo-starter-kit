import * as React from "react";

export function FileUploadDont2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs justify-between rounded-lg border border-border p-3 text-sm">
			<span className="truncate">site-survey.mp4</span>
			<span className="text-muted-foreground">Uploading…</span>
		</div>
	);
}
