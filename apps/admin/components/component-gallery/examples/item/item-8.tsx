import { Badge } from "@workspace/ui/components/badge";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import { ArchiveIcon, FileIcon, InboxIcon, SendIcon, Trash2Icon } from "lucide-react";
import type * as React from "react";

interface MailboxFolder {
	readonly id: string;
	readonly icon: React.JSX.Element;
	readonly label: string;
	readonly count: number;
}

const FOLDERS: readonly MailboxFolder[] = [
	{ id: "inbox", icon: <InboxIcon />, label: "Inbox", count: 12 },
	{ id: "sent", icon: <SendIcon />, label: "Sent", count: 0 },
	{ id: "drafts", icon: <FileIcon />, label: "Drafts", count: 3 },
	{ id: "archive", icon: <ArchiveIcon />, label: "Archive", count: 0 },
	{ id: "trash", icon: <Trash2Icon />, label: "Trash", count: 0 },
];

/** A count badge shows only from this many unread items up (as in reui's sample). */
const MIN_BADGE_COUNT = 2;

/** Each row opens a folder in place, so it renders as a button (reui's sample used `href="#"` links). */
const FOLDER_BUTTON: React.JSX.Element = <button type="button" />;

export function Item8Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-64 flex-col gap-0.5">
			{FOLDERS.map((folder: MailboxFolder): React.JSX.Element => (
				<Item key={folder.id} size="xs" render={FOLDER_BUTTON} className="text-left hover:bg-muted">
					<ItemMedia variant="icon">{folder.icon}</ItemMedia>
					<ItemContent>
						<ItemTitle>{folder.label}</ItemTitle>
					</ItemContent>
					{folder.count >= MIN_BADGE_COUNT ? (
						<ItemActions>
							<Badge variant="success-light" className="rounded-full" size="xs">
								{folder.count}
							</Badge>
						</ItemActions>
					) : null}
				</Item>
			))}
		</div>
	);
}
