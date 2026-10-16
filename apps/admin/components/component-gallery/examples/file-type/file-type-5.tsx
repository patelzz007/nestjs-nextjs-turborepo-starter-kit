import * as React from "react";
import { FILE_TYPE_EXTENSION_NAMES, FileType, getFileTypeCategory, type FileTypeCategory, type FileTypeName, type FileTypeVariant } from "@workspace/ui/components/file-type";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

const VARIANTS: { value: FileTypeVariant; label: string }[] = [
	{ value: "outline", label: "Outline" },
	{ value: "solid", label: "Solid" },
	{ value: "light", label: "Light" },
	{ value: "mono", label: "Mono" },
];

/* Partial: folder and empty are families without an extension, so they
   never form a group here. */
const FAMILY_NAMES: Partial<Record<FileTypeCategory, string>> = {
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

/* Grouped through the primitive's own lookup, so a format added to its
   table lands in the right family with no change here. A Map keeps the
   table's order: documents first, fonts last. */
const GROUPS = Array.from(
	FILE_TYPE_EXTENSION_NAMES.reduce((groups, type) => {
		const category = getFileTypeCategory(type);
		groups.set(category, [...(groups.get(category) ?? []), type]);
		return groups;
	}, new Map<FileTypeCategory, FileTypeName[]>()),
);

export function FileType5Example(): React.JSX.Element {
	return (
		<Tabs defaultValue="outline" className="w-full">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<TabsList aria-label="Variant">
					{VARIANTS.map(({ value, label }) => (
						<TabsTrigger key={value} value={value}>
							{label}
						</TabsTrigger>
					))}
				</TabsList>
				<p className="text-sm text-muted-foreground">
					{FILE_TYPE_EXTENSION_NAMES.length} extensions in {GROUPS.length} families
				</p>
			</div>
			{/* One panel per variant: only the active one is mounted, in both
          bases, so the grid renders once rather than 4 times. */}
			{VARIANTS.map(({ value }) => (
				<TabsContent key={value} value={value}>
					{/* A container query, not the viewport: the family names move
              into a side column once the panel itself is wide enough. */}
					<div className="@container">
						<div className="divide-y">
							{GROUPS.map(([category, types]) => (
								<div key={category} className="flex flex-col gap-3 py-4 last:pb-0 @2xl:flex-row @2xl:gap-6">
									{/* pt-2.5 centers the 20px name line on the 40px icon row. */}
									<p className="flex items-baseline gap-2 text-sm font-medium @2xl:w-36 @2xl:shrink-0 @2xl:pt-2.5">
										{FAMILY_NAMES[category] ?? category}
										<span className="text-xs font-normal text-muted-foreground tabular-nums">{types.length}</span>
									</p>
									{/* gap-2 is enough: the page's ink sits inside its box, so
                      the visible space between icons is nearer 16px. */}
									<ul className="flex flex-wrap gap-2">
										{types.map((type) => (
											<li key={type}>
												<FileType type={type} variant={value} />
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</div>
				</TabsContent>
			))}
		</Tabs>
	);
}
