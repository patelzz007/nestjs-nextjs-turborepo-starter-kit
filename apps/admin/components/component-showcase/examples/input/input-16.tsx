import * as React from "react";
import { HelpCircleIcon } from "lucide-react";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function Input16Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<div className="flex items-center gap-2">
				<FieldLabel htmlFor="username">Username</FieldLabel>
				<Tooltip>
					<TooltipTrigger className="inline-flex items-center">
						<HelpCircleIcon className="size-3.5 text-muted-foreground" />
					</TooltipTrigger>
					<TooltipContent>Your unique identifier on the platform.</TooltipContent>
				</Tooltip>
			</div>
			<Input id="username" placeholder="johndoe" />
			<FieldDescription>Your unique identifier on the platform.</FieldDescription>
		</Field>
	);
}
