import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup35Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline" size="icon" aria-label="Previous page">
				<ChevronLeftIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon">
				1
			</Button>
			<Button variant="outline" size="icon">
				2
			</Button>
			<Button variant="default" size="icon" className="border border-primary">
				3
			</Button>
			<Button variant="outline" size="icon">
				4
			</Button>
			<Button variant="outline" size="icon">
				5
			</Button>
			<Button variant="outline" size="icon" aria-label="Next page">
				<ChevronRightIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
