import * as React from "react";
import { ArrowUpDownIcon, CopyIcon, DownloadIcon, FilterIcon, MoreHorizontalIcon, SettingsIcon, Share2Icon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

const icons = {
	filter: <FilterIcon aria-hidden="true" />,
	sort: <ArrowUpDownIcon aria-hidden="true" />,
	more: <MoreHorizontalIcon aria-hidden="true" />,
	copy: <CopyIcon aria-hidden="true" />,
	share: <Share2Icon aria-hidden="true" />,
	download: <DownloadIcon aria-hidden="true" />,
	settings: <SettingsIcon aria-hidden="true" />,
};

export function ButtonGroup50Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline" size="sm" aria-label="Filter">
				{icons.filter}
			</Button>
			<Button variant="outline" size="sm" aria-label="Sort">
				{icons.sort}
			</Button>
			<ButtonGroupSeparator />
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="outline" size="sm" aria-label="More options" />}>{icons.more}</DropdownMenuTrigger>
				<DropdownMenuContent align="end" sideOffset={8}>
					<DropdownMenuGroup>
						<DropdownMenuItem>
							{icons.copy}
							Copy link
						</DropdownMenuItem>
						<DropdownMenuItem>
							{icons.share}
							Share
						</DropdownMenuItem>
						<DropdownMenuItem>
							{icons.download}
							Export
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem>
							{icons.settings}
							Settings
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
