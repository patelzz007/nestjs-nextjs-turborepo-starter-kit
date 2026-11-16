import * as React from "react";
import { CheckCircleIcon, CheckIcon, ChevronDownIcon, MessageSquareIcon, XIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

const icons = {
	check: <CheckIcon aria-hidden="true" />,
	chevronDown: <ChevronDownIcon aria-hidden="true" />,
	checkCircle: <CheckCircleIcon aria-hidden="true" />,
	messageSquare: <MessageSquareIcon aria-hidden="true" />,
	x: <XIcon aria-hidden="true" />,
};

export function ButtonGroup47Example(): React.JSX.Element {
	return (
		<ButtonGroup className="**:data-[slot=button]:border-x-0">
			<Button variant="default">
				{icons.check}
				Approve
			</Button>
			<ButtonGroupSeparator className="bg-primary-foreground/20" />
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="default" size="icon" aria-label="More approval options" />}>{icons.chevronDown}</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-52">
					<DropdownMenuGroup>
						<DropdownMenuItem>
							{icons.checkCircle}
							Approve with Conditions
						</DropdownMenuItem>
						<DropdownMenuItem>
							{icons.messageSquare}
							Request Changes
						</DropdownMenuItem>
						<DropdownMenuItem variant="destructive">
							{icons.x}
							Reject
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
