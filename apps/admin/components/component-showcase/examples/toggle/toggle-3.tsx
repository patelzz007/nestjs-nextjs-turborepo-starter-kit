import * as React from "react";
import { Toggle } from "@workspace/ui/components/toggle";

export function Toggle3Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			<Toggle variant="outline" size="sm" aria-label="Small toggle">
				Small
			</Toggle>
			<Toggle variant="outline" size="default" aria-label="Default toggle">
				Default
			</Toggle>
			<Toggle variant="outline" size="lg" aria-label="Large toggle">
				Large
			</Toggle>
		</div>
	);
}
