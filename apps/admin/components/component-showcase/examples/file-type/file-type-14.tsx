import * as React from "react";
import { FileType, type FileTypeName } from "@workspace/ui/components/file-type";

interface Badge {
	type: FileTypeName;
	name: string;
	label?: string;
	/** Merged last onto the badge. Its text is a child: `*:text-*` recolors it. */
	className: string;
}

const BADGES: Badge[] = [
	{ type: "pdf", name: "Pill", className: "rounded-full" },
	{
		type: "docx",
		name: "Outline",
		className: "bg-background ring-1 ring-current ring-inset *:text-current",
	},
	{
		type: "xlsx",
		name: "Inverted",
		className: "bg-foreground *:text-background",
	},
	{ type: "json", name: "Monospace", className: "font-mono font-semibold" },
	{
		type: "docx",
		name: "Custom text",
		label: "DRAFT",
		className: "bg-tone-yellow *:text-tone-yellow-soft",
	},
	{
		type: "pdf",
		name: "Larger",
		label: "NEW",
		className: "text-[length:30cqw] font-bold tracking-wide",
	},
];

export function FileType14Example(): React.JSX.Element {
	return (
		<ul className="mx-auto grid w-full max-w-md gap-4">
			{BADGES.map((badge) => (
				<li key={badge.name} className="flex min-w-0 items-center gap-3">
					<FileType type={badge.type} label={badge.label} labelClassName={badge.className} />
					<div className="flex min-w-0 flex-col">
						<span className="truncate text-sm font-medium">{badge.name}</span>
						<code className="truncate font-mono text-xs text-muted-foreground">{badge.className}</code>
					</div>
				</li>
			))}
		</ul>
	);
}
