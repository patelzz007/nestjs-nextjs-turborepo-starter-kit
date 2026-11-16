import * as React from "react";
import { Button } from "@workspace/ui/components/button";

export function ButtonDont1Example(): React.JSX.Element {
	return (
		<div className="flex gap-2">
			<Button>Cancel</Button>
			<Button>Save</Button>
		</div>
	);
}
