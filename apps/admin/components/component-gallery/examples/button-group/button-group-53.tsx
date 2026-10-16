import * as React from "react";
import { ArchiveIcon, CalendarIcon, ChevronDownIcon, CopyIcon, EyeIcon, FileIcon, HistoryIcon, MoreHorizontalIcon, SendIcon, TrashIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Separator } from "@workspace/ui/components/separator";

const viewers = [
	{
		src: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		initials: "SC",
		name: "Sarah Chen",
	},
	{
		src: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		initials: "AJ",
		name: "Alex Johnson",
	},
];

export function ButtonGroup53Example(): React.JSX.Element {
	return (
		<div className="flex shrink-0 items-center gap-2">
			<AvatarGroup>
				{viewers.map((viewer) => (
					<Avatar key={viewer.name} size="sm">
						<AvatarImage src={viewer.src} alt={viewer.name} />
						<AvatarFallback>{viewer.initials}</AvatarFallback>
					</Avatar>
				))}
			</AvatarGroup>

			<Separator orientation="vertical" className="my-auto h-4" />

			<Button variant="outline" size="sm">
				<EyeIcon aria-hidden="true" />
				<span className="hidden md:block">Preview</span>
			</Button>

			<ButtonGroup className="**:data-[slot=button]:border-r-0">
				<Button size="sm">
					<SendIcon aria-hidden="true" />
					Publish
				</Button>

				<ButtonGroupSeparator className="bg-primary/72" />

				<DropdownMenu>
					<DropdownMenuTrigger render={<Button size="icon-sm" className="rounded-l-none border-l border-primary-foreground/20" aria-label="More publish options" />}>
						<ChevronDownIcon aria-hidden="true" />
					</DropdownMenuTrigger>

					<DropdownMenuContent sideOffset={8} align="end" className="w-48">
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<CalendarIcon className="size-4 opacity-60" aria-hidden="true" />
								Schedule for later
							</DropdownMenuItem>
							<DropdownMenuItem>
								<FileIcon className="size-4 opacity-60" aria-hidden="true" />
								Save as draft
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</ButtonGroup>

			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
					<MoreHorizontalIcon aria-hidden="true" />
				</DropdownMenuTrigger>

				<DropdownMenuContent sideOffset={8} align="end" className="w-40">
					<DropdownMenuGroup>
						<DropdownMenuItem>
							<CopyIcon className="size-4 opacity-60" aria-hidden="true" />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuItem>
							<HistoryIcon className="size-4 opacity-60" aria-hidden="true" />
							View history
						</DropdownMenuItem>
						<DropdownMenuItem>
							<ArchiveIcon className="size-4 opacity-60" aria-hidden="true" />
							Archive
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive">
							<TrashIcon aria-hidden="true" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
