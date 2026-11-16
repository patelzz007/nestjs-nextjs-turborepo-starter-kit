import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from "lucide-react";

export function ButtonGroupDont2Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline" size="icon">
				<AlignLeftIcon />
			</Button>
			<Button variant="outline" size="icon">
				<AlignCenterIcon />
			</Button>
			<Button variant="outline" size="icon">
				<AlignRightIcon />
			</Button>
		</ButtonGroup>
	);
}
