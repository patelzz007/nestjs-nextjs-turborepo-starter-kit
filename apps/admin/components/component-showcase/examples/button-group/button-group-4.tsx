import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

export function ButtonGroup4Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline">Update</Button>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="outline" size="icon" aria-label="More options">
							<ChevronDownIcon aria-hidden="true" />
						</Button>
					}
				/>
				<DropdownMenuContent align="end" className="w-36">
					<DropdownMenuItem>Production</DropdownMenuItem>
					<DropdownMenuItem>Staging</DropdownMenuItem>
					<DropdownMenuItem>Development</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
