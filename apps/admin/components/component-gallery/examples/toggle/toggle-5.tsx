import * as React from "react";
import { Toggle } from "@workspace/ui/components/toggle";

export function Toggle5Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			<Toggle aria-label="Disabled toggle" disabled>
				Disabled
			</Toggle>
			<Toggle variant="outline" aria-label="Disabled outline toggle" disabled>
				Disabled
			</Toggle>
		</div>
	);
}
