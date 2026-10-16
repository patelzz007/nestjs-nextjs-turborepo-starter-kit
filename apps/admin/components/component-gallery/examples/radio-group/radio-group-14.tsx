import * as React from "react";
import { HelpCircleIcon } from "lucide-react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function RadioGroup14Example(): React.JSX.Element {
	return (
		<RadioGroup defaultValue="public" className="w-full max-w-xs">
			<Field orientation="horizontal">
				<RadioGroupItem value="public" id="vis-public" />
				<div className="flex items-center gap-1.5">
					<FieldLabel htmlFor="vis-public">Public</FieldLabel>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger className="text-muted-foreground">
								<span>
									<HelpCircleIcon aria-hidden="true" className="size-3.5" />
								</span>
							</TooltipTrigger>
							<TooltipContent side="right">Anyone on the internet can see this.</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</Field>
			<Field orientation="horizontal">
				<RadioGroupItem value="private" id="vis-private" />
				<div className="flex items-center gap-1.5">
					<FieldLabel htmlFor="vis-private">Private</FieldLabel>
					<Tooltip>
						<TooltipTrigger className="text-muted-foreground">
							<HelpCircleIcon aria-hidden="true" className="size-3.5" />
						</TooltipTrigger>
						<TooltipContent side="right">Only you and collaborators can access this.</TooltipContent>
					</Tooltip>
				</div>
			</Field>
		</RadioGroup>
	);
}
