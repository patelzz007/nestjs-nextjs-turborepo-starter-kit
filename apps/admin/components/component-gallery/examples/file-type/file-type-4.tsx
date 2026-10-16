import * as React from "react";
import { FILE_TYPE_CATEGORIES, FileType } from "@workspace/ui/components/file-type";

// The blank page goes last: it stands for a file with no type, so it closes
// the set instead of sitting between two families.
type FileTypeFamily = (typeof FILE_TYPE_CATEGORIES)[number];

const families: readonly FileTypeFamily[] = [...FILE_TYPE_CATEGORIES.filter((family: FileTypeFamily): boolean => family !== "empty"), "empty"];

export function FileType4Example(): React.JSX.Element {
	// Cells fit "Presentation" in a monospace font. The width cap holds a row
	// to 5, so with room the 13 families wrap as 5, 5 and a centered 3.
	return (
		<ul className="mx-auto flex max-w-lg flex-wrap justify-center gap-x-1 gap-y-5">
			{families.map((family: FileTypeFamily): React.JSX.Element => (
				<li key={family} className="flex w-22 flex-col items-center gap-2">
					{/* The caption names the family, so the icon would read twice. */}
					<FileType type={family} aria-hidden="true" />
					<span className="text-xs text-muted-foreground capitalize">{family}</span>
				</li>
			))}
		</ul>
	);
}
