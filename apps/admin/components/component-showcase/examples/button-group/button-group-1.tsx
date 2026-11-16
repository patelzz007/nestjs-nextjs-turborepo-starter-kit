import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup1Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline">Button</Button>
			<Button variant="outline">Another Button</Button>
		</ButtonGroup>
	);
}
