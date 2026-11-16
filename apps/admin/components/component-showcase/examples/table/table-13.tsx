import * as React from "react";
import { FileSpreadsheetIcon, FileTextIcon, FolderIcon, ImageIcon, PenToolIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";

interface SharedFile {
	readonly name: string;
	readonly icon: React.ReactNode;
	readonly size: string;
	readonly owner: string;
	readonly ownerAvatar: string;
	readonly sharing: string;
	readonly sharingVariant: BadgeVariant;
	readonly modified: string;
}

const files: readonly SharedFile[] = [
	{
		name: "Q4 Financial Report.pdf",
		icon: <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
		size: "2.4 MB",
		owner: "Sarah Chen",
		ownerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
		sharing: "Team",
		sharingVariant: "info-light",
		modified: "2 hours ago",
	},
	{
		name: "Brand Guidelines",
		icon: <FolderIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
		size: "—",
		owner: "Emily Park",
		ownerAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
		sharing: "Public",
		sharingVariant: "success-light",
		modified: "1 day ago",
	},
	{
		name: "Product Roadmap 2025.xlsx",
		icon: <FileSpreadsheetIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
		size: "856 KB",
		owner: "Marcus Johnson",
		ownerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		sharing: "Private",
		sharingVariant: "outline",
		modified: "3 days ago",
	},
	{
		name: "App Screenshots",
		icon: <ImageIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
		size: "48.2 MB",
		owner: "David Kim",
		ownerAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&dpr=2&q=80",
		sharing: "Team",
		sharingVariant: "info-light",
		modified: "1 week ago",
	},
	{
		name: "Architecture Diagram.fig",
		icon: <PenToolIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
		size: "12.8 MB",
		owner: "Sofia Davis",
		ownerAvatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		sharing: "Restricted",
		sharingVariant: "warning-light",
		modified: "2 weeks ago",
	},
];

export function Table13Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Owner</TableHead>
						<TableHead>Sharing</TableHead>
						<TableHead>Size</TableHead>
						<TableHead className="text-right">Modified</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{files.map((file) => (
						<TableRow key={file.name}>
							<TableCell>
								<div className="flex items-center gap-3">
									{file.icon}
									<span className="text-sm font-medium">{file.name}</span>
								</div>
							</TableCell>
							<TableCell>
								<div className="flex items-center gap-2">
									<Avatar size="sm">
										<AvatarImage src={file.ownerAvatar} alt={file.owner} />
										<AvatarFallback>
											{file.owner
												.split(" ")
												.map((part) => part.charAt(0))
												.join("")}
										</AvatarFallback>
									</Avatar>
									<span className="text-sm">{file.owner}</span>
								</div>
							</TableCell>
							<TableCell>
								<Badge variant={file.sharingVariant} size="sm">
									{file.sharing}
								</Badge>
							</TableCell>
							<TableCell className="text-sm text-muted-foreground">{file.size}</TableCell>
							<TableCell className="text-right text-sm text-muted-foreground">{file.modified}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
