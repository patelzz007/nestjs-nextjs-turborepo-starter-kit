import * as React from "react";
import { Rating } from "@workspace/ui/components/rating";

export function Rating5Example(): React.JSX.Element {
	return (
		<div className="flex flex-col items-center gap-4">
			<Rating rating={4} size="sm" />
			<Rating rating={4} />
			<Rating rating={4} size="lg" />
		</div>
	);
}
