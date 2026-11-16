import * as React from "react";
import { LayoutGridIcon, ListIcon, TableIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup24Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline" size="icon" aria-label="Grid view">
				<LayoutGridIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="List view">
				<ListIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="Table view">
				<TableIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
