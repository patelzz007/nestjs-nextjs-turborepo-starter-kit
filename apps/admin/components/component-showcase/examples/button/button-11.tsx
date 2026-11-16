import * as React from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button11Example(): React.JSX.Element {
	return (
		<Button size="icon" aria-label="Search">
			<SearchIcon aria-hidden="true" />
		</Button>
	);
}
