import { Badge } from "@workspace/ui-native/components/badge";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import ArchiveIcon from "lucide-react-native/icons/archive";
import FileIcon from "lucide-react-native/icons/file";
import InboxIcon from "lucide-react-native/icons/inbox";
import SendIcon from "lucide-react-native/icons/send";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

interface MailboxFolder {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly count: number;
}

const FOLDERS: readonly MailboxFolder[] = [
	{ icon: InboxIcon, label: "Inbox", count: 12 },
	{ icon: SendIcon, label: "Sent", count: 0 },
	{ icon: FileIcon, label: "Drafts", count: 3 },
	{ icon: ArchiveIcon, label: "Archive", count: 0 },
	{ icon: Trash2Icon, label: "Trash", count: 0 },
];

/** A count badge shows only from this many unread items up. */
const MIN_BADGE_COUNT = 2;

export function Item8Example(): React.JSX.Element {
	return (
		<View className="gap-0.5">
			{FOLDERS.map((folder: MailboxFolder): React.JSX.Element => (
				<Item
					key={folder.label}
					size="xs"
					onPress={ignorePress}
					accessibilityRole="button"
					accessibilityLabel={folder.count >= MIN_BADGE_COUNT ? `${folder.label}, ${String(folder.count)} unread` : folder.label}>
					<ItemMedia variant="icon">
						<Icon icon={folder.icon} size="sm" colorClassName="accent-foreground" />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>{folder.label}</ItemTitle>
					</ItemContent>
					{folder.count >= MIN_BADGE_COUNT ? (
						<ItemActions>
							<Badge label={String(folder.count)} tone="success" variant="light" size="sm" />
						</ItemActions>
					) : null}
				</Item>
			))}
		</View>
	);
}
