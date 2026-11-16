import * as React from "react";
import { FileType, type FileTypeProps } from "@workspace/ui/components/file-type";

/** Each size step, with its rendered height for the caption. */
interface SizeStep {
	readonly size: NonNullable<FileTypeProps["size"]>;
	readonly px: number;
}

const sizes: readonly SizeStep[] = [
	{ size: "mini", px: 18 },
	{ size: "xs", px: 24 },
	{ size: "sm", px: 32 },
	{ size: "default", px: 40 },
	{ size: "lg", px: 48 },
	{ size: "xl", px: 56 },
];

export function FileType3Example(): React.JSX.Element {
	// Every caption is 2 lines, so `items-end` lines up the icons' bottoms.
	return (
		<div className="mx-auto flex w-fit items-end gap-6">
			{sizes.map(({ size, px }: SizeStep): React.JSX.Element => (
				<div key={size} className="flex flex-col items-center gap-3">
					<FileType type="pdf" size={size} />
					{/* A zero-width caption centers on the icon without widening its
              column, so the gaps between icons are equal, not between
              captions ("default" is wider than its icon). */}
					<span className="flex w-0 flex-col items-center text-xs whitespace-nowrap">
						<span className="font-medium">{size}</span>
						<span className="text-muted-foreground tabular-nums">{px}px</span>
					</span>
				</div>
			))}
		</div>
	);
}
