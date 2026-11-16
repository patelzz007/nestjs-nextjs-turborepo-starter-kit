import * as React from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button18Example(): React.JSX.Element {
	return (
		<Button variant="outline">
			<PlusIcon aria-hidden="true" />
			Add Item
		</Button>
	);
}
