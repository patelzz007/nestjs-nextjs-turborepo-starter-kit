import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroupDont1Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline">Print</Button>
			<Button variant="outline">Sign out</Button>
		</ButtonGroup>
	);
}
