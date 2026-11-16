import * as React from "react";
import { BellIcon, ChevronDownIcon, EyeIcon, FlagIcon, GitForkIcon, ListPlusIcon, Share2Icon, StarIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

export function ButtonGroup15Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline">
				<StarIcon aria-hidden="true" />
				<span>Star</span>
				<Badge variant="secondary">2.4k</Badge>
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More options" />}>
					<ChevronDownIcon aria-hidden="true" />
					<span className="sr-only">Toggle dropdown</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-40">
					<DropdownMenuItem>
						<EyeIcon aria-hidden="true" />
						Watch
					</DropdownMenuItem>
					<DropdownMenuItem>
						<GitForkIcon aria-hidden="true" />
						Fork
					</DropdownMenuItem>
					<DropdownMenuItem>
						<ListPlusIcon aria-hidden="true" />
						Add to list
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem>
						<Share2Icon aria-hidden="true" />
						Share
					</DropdownMenuItem>
					<DropdownMenuItem>
						<BellIcon aria-hidden="true" />
						Notifications
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem>
						<FlagIcon aria-hidden="true" />
						Report
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
