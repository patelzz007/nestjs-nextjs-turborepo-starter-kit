import * as React from "react";
import { ChevronDownIcon, ListFilterIcon, XIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";

export function ButtonGroup16Example(): React.JSX.Element {
	return (
		<ButtonGroup className="max-w-xs">
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="outline" aria-label="Filter">
							<ListFilterIcon aria-hidden="true" />
							Filter
							<ChevronDownIcon aria-hidden="true" />
						</Button>
					}
				/>
				<DropdownMenuContent align="start" className="w-40">
					<DropdownMenuItem>All Records</DropdownMenuItem>
					<DropdownMenuItem>Recent</DropdownMenuItem>
					<DropdownMenuItem>Archived</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Input placeholder="Filter records..." />
			<Button variant="outline" size="icon" aria-label="Clear">
				<XIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
