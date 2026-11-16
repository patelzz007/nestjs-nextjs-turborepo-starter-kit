import * as React from "react";
import { FlipHorizontalIcon, FlipVerticalIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup6Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline" size="icon" aria-label="Flip horizontally">
				<FlipHorizontalIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="Flip vertically">
				<FlipVerticalIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="Rotate">
				<RotateCwIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
