import * as React from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup10Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline" size="sm">
				<ArrowLeftIcon aria-hidden="true" />
				Previous
			</Button>
			<Button variant="outline" size="sm">
				1
			</Button>
			<Button variant="outline" size="sm">
				2
			</Button>
			<Button variant="outline" size="sm">
				3
			</Button>
			<Button variant="outline" size="sm">
				Next
				<ArrowRightIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
