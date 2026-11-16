import * as React from "react";
import { HelpCircleIcon } from "lucide-react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Switch9Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Field orientation="horizontal">
				<Switch id="sw-tooltip" />
				<div className="flex items-center gap-1.5">
					<FieldLabel htmlFor="sw-tooltip">Two-factor authentication</FieldLabel>
					<Tooltip>
						<TooltipTrigger className="text-muted-foreground">
							<HelpCircleIcon aria-hidden="true" className="size-3.5" />
						</TooltipTrigger>
						<TooltipContent side="right">Adds an extra layer of security by requiring a verification code on login.</TooltipContent>
					</Tooltip>
				</div>
			</Field>
		</div>
	);
}
