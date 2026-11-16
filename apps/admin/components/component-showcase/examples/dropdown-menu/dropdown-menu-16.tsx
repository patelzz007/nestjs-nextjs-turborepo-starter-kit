import * as React from "react";
import { MoreHorizontalIcon, SettingsIcon, Share2Icon, TrashIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

const icons = {
	more: <MoreHorizontalIcon aria-hidden="true" />,
	settings: <SettingsIcon aria-hidden="true" />,
	share: <Share2Icon aria-hidden="true" />,
	trash: <TrashIcon aria-hidden="true" />,
};

export function DropdownMenu16Example(): React.JSX.Element {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="-me-1.5" aria-label="More options" />}>{icons.more}</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-36">
				<DropdownMenuGroup>
					<DropdownMenuItem>
						{icons.settings}
						Settings
					</DropdownMenuItem>
					<DropdownMenuItem>
						{icons.share}
						Share
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive">
						{icons.trash}
						Remove
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
