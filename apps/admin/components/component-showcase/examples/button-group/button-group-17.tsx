import * as React from "react";
import { AlertTriangleIcon, CheckIcon, CopyIcon, EllipsisVerticalIcon, MessageCircleIcon, TrashIcon, UploadIcon, UserRoundXIcon, VolumeXIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

export function ButtonGroup17Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline">
				<MessageCircleIcon aria-hidden="true" />
				<span>Conversation</span>
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More options" />}>
					<EllipsisVerticalIcon aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuGroup>
						<DropdownMenuItem>
							<VolumeXIcon aria-hidden="true" />
							Mute Conversation
						</DropdownMenuItem>
						<DropdownMenuItem>
							<CheckIcon aria-hidden="true" />
							Mark as Read
						</DropdownMenuItem>
						<DropdownMenuItem>
							<AlertTriangleIcon aria-hidden="true" />
							Report Conversation
						</DropdownMenuItem>
						<DropdownMenuItem>
							<UserRoundXIcon aria-hidden="true" />
							Block User
						</DropdownMenuItem>
						<DropdownMenuItem>
							<UploadIcon aria-hidden="true" />
							Share Conversation
						</DropdownMenuItem>
						<DropdownMenuItem>
							<CopyIcon aria-hidden="true" />
							Copy Link
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem variant="destructive">
							<TrashIcon aria-hidden="true" />
							Delete Conversation
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
