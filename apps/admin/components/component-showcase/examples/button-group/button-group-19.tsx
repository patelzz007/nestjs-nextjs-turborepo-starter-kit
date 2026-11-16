import * as React from "react";
import { EllipsisVerticalIcon, SearchIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";

export function ButtonGroup19Example(): React.JSX.Element {
	return (
		<ButtonGroup className="max-w-xs">
			<InputGroup>
				<InputGroupAddon>
					<SearchIcon aria-hidden="true" />
				</InputGroupAddon>
				<InputGroupInput placeholder="Filter records..." />
			</InputGroup>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="outline" size="icon" aria-label="Filter">
							<EllipsisVerticalIcon aria-hidden="true" />
						</Button>
					}
				/>
				<DropdownMenuContent align="end" className="w-40">
					<DropdownMenuItem>All Records</DropdownMenuItem>
					<DropdownMenuItem>Recent</DropdownMenuItem>
					<DropdownMenuItem>Archived</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
