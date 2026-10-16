import * as React from "react";
import { FileSpreadsheetIcon, FileTextIcon, ImageIcon, LinkIcon, MailIcon, MessageCircleIcon, PrinterIcon, Share2Icon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

export function DropdownMenu13Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="outline" className="w-fit gap-2">
							<Share2Icon aria-hidden="true" />
							Share
						</Button>
					}
				/>
				<DropdownMenuContent className="w-48" align="start">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Share via</DropdownMenuLabel>
						<DropdownMenuItem>
							<MailIcon aria-hidden="true" />
							Email
						</DropdownMenuItem>
						<DropdownMenuItem>
							<MessageCircleIcon aria-hidden="true" />
							Message
						</DropdownMenuItem>
						<DropdownMenuItem>
							<LinkIcon aria-hidden="true" />
							Copy Link
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuLabel>Export as</DropdownMenuLabel>
						<DropdownMenuItem>
							<FileTextIcon aria-hidden="true" />
							PDF
						</DropdownMenuItem>
						<DropdownMenuItem>
							<FileSpreadsheetIcon aria-hidden="true" />
							CSV
						</DropdownMenuItem>
						<DropdownMenuItem>
							<ImageIcon aria-hidden="true" />
							PNG
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem>
						<PrinterIcon aria-hidden="true" />
						Print
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
