import { FILE_TYPE_EXTENSION_NAMES, getFileTypeCategory, type FileTypeCategory } from "@workspace/ui-kit-logic";
import { FileType, type FileTypeVariant } from "@workspace/ui-native/components/file-type";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
import * as React from "react";
import { Text, View } from "react-native";

const VARIANTS: readonly { readonly value: FileTypeVariant; readonly label: string }[] = [
	{ value: "outline", label: "Outline" },
	{ value: "solid", label: "Solid" },
	{ value: "light", label: "Light" },
	{ value: "mono", label: "Mono" },
];

/** Folder and empty are families with no extension, so they never form a group here. */
const FAMILY_NAMES: Partial<Readonly<Record<FileTypeCategory, string>>> = {
	document: "Documents",
	spreadsheet: "Spreadsheets",
	presentation: "Presentations",
	image: "Images",
	video: "Video",
	audio: "Audio",
	code: "Code and data",
	archive: "Archives",
	design: "Design",
	executable: "Applications",
	font: "Fonts",
};

/** Grouped by the shared table's own lookup, in its order: a format added to it lands in the right family. */
const GROUPS: readonly (readonly [FileTypeCategory, readonly string[]])[] = Array.from(
	FILE_TYPE_EXTENSION_NAMES.reduce((groups: Map<FileTypeCategory, string[]>, type: string): Map<FileTypeCategory, string[]> => {
		const category = getFileTypeCategory(type);
		groups.set(category, [...(groups.get(category) ?? []), type]);
		return groups;
	}, new Map<FileTypeCategory, string[]>()),
);

export function FileType5Example(): React.JSX.Element {
	const [tab, setTab] = React.useState("outline");
	return (
		<Tabs value={tab} onChange={setTab}>
			<TabsList accessibilityLabel="Variant">
				{VARIANTS.map((variant): React.JSX.Element => (
					<TabsTrigger key={variant.value} value={variant.value} label={variant.label} />
				))}
			</TabsList>
			<Text className="text-label font-sans text-muted-foreground">{`${String(FILE_TYPE_EXTENSION_NAMES.length)} extensions in ${String(GROUPS.length)} families`}</Text>
			{VARIANTS.map((variant): React.JSX.Element => (
				<TabsContent key={variant.value} value={variant.value}>
					{GROUPS.map(([category, types]): React.JSX.Element => (
						<View key={category} className="gap-3 border-b border-border py-4">
							<Text className="text-label font-sans-medium text-foreground">
								{FAMILY_NAMES[category] ?? category} <Text className="text-caption font-sans text-muted-foreground tabular-nums">{String(types.length)}</Text>
							</Text>
							<View className="flex-row flex-wrap gap-2">
								{types.map((type: string): React.JSX.Element => (
									<FileType key={type} type={type} variant={variant.value} />
								))}
							</View>
						</View>
					))}
				</TabsContent>
			))}
		</Tabs>
	);
}
