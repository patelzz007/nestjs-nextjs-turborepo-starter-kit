import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Trash2Icon } from "lucide-react";

export function ButtonDo3Example(): React.JSX.Element {
	return (
		<Button variant="destructive">
			<Trash2Icon aria-hidden="true" />
			Delete project
		</Button>
	);
}
