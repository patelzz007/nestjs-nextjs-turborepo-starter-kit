import * as React from "react";
import { Button } from "@workspace/ui/components/button";

export function ButtonDo1Example(): React.JSX.Element {
	return (
		<div className="flex gap-2">
			<Button variant="outline">Cancel</Button>
			<Button>Save</Button>
		</div>
	);
}
