import * as React from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button22Example(): React.JSX.Element {
	return (
		<Button variant="destructive">
			<Trash2Icon aria-hidden="true" />
			Delete Account
		</Button>
	);
}
