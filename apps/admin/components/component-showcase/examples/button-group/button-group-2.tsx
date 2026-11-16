import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { Input } from "@workspace/ui/components/input";

export function ButtonGroup2Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline">Button</Button>
			<Input placeholder="Type something here..." />
		</ButtonGroup>
	);
}
