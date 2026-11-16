import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

const VIEWS: readonly string[] = ["Day", "Three days", "Work week", "Week", "Fortnight", "Month", "Quarter", "Year"];

export function ButtonGroupDont3Example(): React.JSX.Element {
	return (
		<div className="w-72 overflow-hidden">
			<ButtonGroup>
				{VIEWS.map((view: string): React.JSX.Element => (
					<Button key={view} variant="outline" className="min-w-0 truncate">
						{view}
					</Button>
				))}
			</ButtonGroup>
		</div>
	);
}
