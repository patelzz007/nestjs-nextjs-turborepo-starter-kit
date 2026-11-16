import * as React from "react";
import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup40Example(): React.JSX.Element {
	return (
		<ButtonGroup orientation="vertical">
			<Button variant="outline" className={cn("justify-start bg-muted")}>
				Dashboard
			</Button>
			<Button variant="outline" className="justify-start">
				Analytics
			</Button>
			<Button variant="outline" className="justify-start">
				Settings
			</Button>
			<Button variant="outline" className="justify-start">
				Help
			</Button>
		</ButtonGroup>
	);
}
