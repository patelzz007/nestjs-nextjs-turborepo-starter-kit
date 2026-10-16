import * as React from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup13Example(): React.JSX.Element {
	return (
		<ButtonGroup orientation="vertical">
			<Button variant="outline" size="icon" aria-label="Add">
				<PlusIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="Subtract">
				<MinusIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
