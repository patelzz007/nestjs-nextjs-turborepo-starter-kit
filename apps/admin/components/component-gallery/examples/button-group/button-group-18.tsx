import * as React from "react";
import { ChevronDownIcon, PlayIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

export function ButtonGroup18Example(): React.JSX.Element {
	return (
		<ButtonGroup className="**:data-[slot=button]:border-r-0">
			<Button>
				<PlayIcon aria-hidden="true" className="fill-current" />
				<span>Execute</span>
			</Button>
			<ButtonGroupSeparator className="bg-primary/72" />
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button size="icon" className="rounded-l-none border-l border-primary-foreground/20" aria-label="More options" />}>
					<ChevronDownIcon aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-40">
					<DropdownMenuItem>Commit & Push</DropdownMenuItem>
					<DropdownMenuItem>Commit & Sync</DropdownMenuItem>
					<DropdownMenuItem>Amend Last Commit</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
