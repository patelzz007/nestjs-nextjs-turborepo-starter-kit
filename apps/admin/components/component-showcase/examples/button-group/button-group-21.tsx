import * as React from "react";
import { FileIcon, PlusIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";

export function ButtonGroup21Example(): React.JSX.Element {
	return (
		<ButtonGroup className="max-w-xs">
			<InputGroup>
				<InputGroupAddon>
					<FileIcon aria-hidden="true" />
				</InputGroupAddon>
				<InputGroupInput placeholder="Enter file name..." />
			</InputGroup>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="outline" size="icon" aria-label="Filter">
							<PlusIcon aria-hidden="true" />
						</Button>
					}
				/>
				<DropdownMenuContent align="end" className="w-40">
					<DropdownMenuItem>New File</DropdownMenuItem>
					<DropdownMenuItem>New Folder</DropdownMenuItem>
					<DropdownMenuItem>New Workspace</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
