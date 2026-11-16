import * as React from "react";
import { CoverImage } from "@workspace/ui/components/cover-image";

export function CoverImageDont2Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<CoverImage src={null} alt="" className="rounded-lg" />
		</div>
	);
}
