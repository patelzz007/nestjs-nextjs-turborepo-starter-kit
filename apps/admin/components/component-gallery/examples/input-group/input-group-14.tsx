import * as React from "react";
import { InfoIcon } from "lucide-react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function InputGroup14Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<InputGroup>
				<InputGroupInput type="number" defaultValue="5000" />
				<InputGroupAddon align="inline-end">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger render={<InputGroupButton variant="ghost" size="icon-xs" />}>
								<InfoIcon />
							</TooltipTrigger>
							<TooltipContent>Monthly request limit</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
