import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { MinusIcon, PlusIcon } from "lucide-react";

export function ButtonGroupDo1Example(): React.JSX.Element {
	return (
		<ButtonGroup aria-label="Quantity">
			<Button variant="outline" size="icon" aria-label="Fewer">
				<MinusIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="More">
				<PlusIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
