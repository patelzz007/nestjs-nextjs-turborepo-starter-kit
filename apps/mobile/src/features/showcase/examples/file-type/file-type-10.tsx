import { getFileType } from "@workspace/ui-kit-logic";
import { FileType } from "@workspace/ui-native/components/file-type";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import * as React from "react";
import { Text, View } from "react-native";

interface Revision {
	readonly file: string;
	readonly label: string;
	readonly note: string;
	readonly date: string;
}

/** The line under a revision's file name. */
function detailOf(revision: Revision): string {
	return `${revision.note} · ${revision.date}`;
}

/** Newest first: a version tag in place of the extension; a longer tag keeps the band and sets its text smaller. */
const REVISIONS: readonly Revision[] = [
	{ file: "agreement-signed.pdf", label: "SIGNED", note: "Countersigned", date: "Oct 4" },
	{ file: "agreement-v3.docx", label: "V3", note: "Counsel review", date: "Sep 28" },
	{ file: "agreement-v2.docx", label: "V2", note: "Pricing schedule added", date: "Sep 19" },
	{ file: "agreement-v1.docx", label: "V1", note: "First draft", date: "Sep 12" },
];

export function FileType10Example(): React.JSX.Element {
	return (
		<View className="gap-4">
			<View className="flex-row items-center gap-3">
				{/* A string label joins the spoken name: "CA-1042, File". */}
				<FileType type="empty" variant="light" size="xl" label="CA-1042" />
				<View className="flex-1 gap-0.5">
					<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
						Supply agreement
					</Text>
					<Text numberOfLines={1} className="text-label font-sans text-muted-foreground">{`Northwind Foods · ${String(REVISIONS.length)} revisions`}</Text>
				</View>
			</View>
			<ItemGroup size="sm">
				{REVISIONS.map((revision: Revision): React.JSX.Element => (
					<Item key={revision.file} variant="outline" size="sm">
						<ItemMedia>
							<FileType type={getFileType(revision.file)} variant="light" label={revision.label} />
						</ItemMedia>
						<ItemContent>
							<ItemTitle>{revision.file}</ItemTitle>
							<ItemDescription>{detailOf(revision)}</ItemDescription>
						</ItemContent>
					</Item>
				))}
			</ItemGroup>
		</View>
	);
}
