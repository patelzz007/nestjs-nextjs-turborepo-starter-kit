import * as React from "react";
import { Spinner } from "@workspace/ui/components/spinner";

export function ProgressDont1Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2 text-sm">
			<Spinner />
			Uploading photos…
		</div>
	);
}
