import * as React from "react";
import { HelpCircleIcon } from "lucide-react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Checkbox20Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" className="w-auto">
			<Checkbox id="tooltip-checkbox" />

			<div className="flex items-center gap-1.5">
				<FieldLabel htmlFor="tooltip-checkbox">Enable advanced analytics</FieldLabel>
				<Tooltip>
					<TooltipTrigger className="text-muted-foreground">
						<HelpCircleIcon aria-hidden="true" className="size-3.5" />
					</TooltipTrigger>
					<TooltipContent side="right">Advanced analytics provides deeper insights into user behavior and system performance.</TooltipContent>
				</Tooltip>
			</div>
		</Field>
	);
}
