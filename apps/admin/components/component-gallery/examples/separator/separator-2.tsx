import * as React from "react";
import { Separator } from "@workspace/ui/components/separator";

export function Separator2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<div className="flex h-5 items-center gap-4 text-sm">
				<div>Blog</div>
				<Separator orientation="vertical" />
				<div>Docs</div>
				<Separator orientation="vertical" />
				<div>Source</div>
			</div>
		</div>
	);
}
