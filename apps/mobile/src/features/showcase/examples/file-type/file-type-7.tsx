import { getFileType } from "@workspace/ui-kit-logic";
import { FileType } from "@workspace/ui-native/components/file-type";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import DownloadIcon from "lucide-react-native/icons/download";
import * as React from "react";

import { ignorePress } from "../example-support";

interface Attachment {
	readonly id: string;
	readonly name: string;
	readonly size: string;
	readonly modified: string;
}

/** The line under a file's name. */
function detailOf(file: Attachment): string {
	return `${file.size} · ${file.modified}`;
}

const ATTACHMENTS: readonly Attachment[] = [
	{ id: "agreement", name: "master-services-agreement-signed.pdf", size: "2.1 MB", modified: "Oct 6" },
	{ id: "deck", name: "q3-board-deck.pptx", size: "18.4 MB", modified: "Oct 2" },
	{ id: "forecast", name: "revenue-forecast-2027.xlsx", size: "860 KB", modified: "Sep 29" },
	{ id: "brief", name: "launch-brief.docx", size: "312 KB", modified: "Sep 24" },
	{ id: "demo", name: "product-demo.mp4", size: "64.2 MB", modified: "Sep 18" },
];

// Light pages inside outlined rows: an outlined page would read as a second frame. The icon is decorative here: the name ends in its extension.
export function FileType7Example(): React.JSX.Element {
	return (
		<ItemGroup size="sm">
			{ATTACHMENTS.map((file: Attachment): React.JSX.Element => (
				<Item key={file.id} variant="outline" size="sm">
					<ItemMedia>
						<FileType type={getFileType(file.name)} variant="light" />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>{file.name}</ItemTitle>
						<ItemDescription>{detailOf(file)}</ItemDescription>
					</ItemContent>
					<ItemActions>
						<IconButton icon={DownloadIcon} label={`Download ${file.name}`} variant="ghost" size="sm" onPress={ignorePress} />
					</ItemActions>
				</Item>
			))}
		</ItemGroup>
	);
}
