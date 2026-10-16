import * as React from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup11Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<ButtonGroup>
				<Button variant="outline" size="icon-sm" aria-label="Go back">
					<ArrowLeftIcon aria-hidden="true" />
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
				<Button variant="outline" size="icon-sm" aria-label="Go forward">
					<ArrowRightIcon aria-hidden="true" />
				</Button>
			</ButtonGroup>
		</ButtonGroup>
	);
}
