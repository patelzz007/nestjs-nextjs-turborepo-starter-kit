import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from "lucide-react";

export function ButtonGroupDo2Example(): React.JSX.Element {
	return (
		<ButtonGroup aria-label="Text alignment">
			<Button variant="outline" size="icon" aria-label="Align left">
				<AlignLeftIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="Align centre">
				<AlignCenterIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="Align right">
				<AlignRightIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
