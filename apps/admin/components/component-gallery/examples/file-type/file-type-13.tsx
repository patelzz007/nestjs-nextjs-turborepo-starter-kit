import * as React from "react";
import { CloudUploadIcon, EyeOffIcon, LinkIcon, LockIcon, ShieldCheckIcon, StarIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FileType, type FileTypeName } from "@workspace/ui/components/file-type";

interface FileState {
	type: FileTypeName;
	/** Names the state and the type, so the icons can stay hidden. */
	caption: string;
	icon: ReactNode;
}

const FILES: FileState[] = [
	{
		type: "pdf",
		caption: "Locked PDF",
		icon: <LockIcon />,
	},
	{
		type: "docx",
		caption: "Verified DOCX",
		icon: <ShieldCheckIcon />,
	},
	{
		type: "xlsx",
		caption: "Shared XLSX",
		icon: <LinkIcon />,
	},
	{
		type: "png",
		caption: "Starred PNG",
		icon: <StarIcon />,
	},
	{
		type: "fig",
		caption: "Hidden FIG",
		icon: <EyeOffIcon />,
	},
	{
		type: "zip",
		caption: "Uploading ZIP",
		icon: <CloudUploadIcon />,
	},
];

export function FileType13Example(): React.JSX.Element {
	return (
		<ul className="mx-auto grid w-fit grid-cols-3 gap-x-8 gap-y-6">
			{FILES.map((file) => (
				<li key={file.type} className="flex flex-col items-center gap-2.5">
					{/* The icon takes the glyph's place and color in every variant. */}
					<div className="flex gap-2">
						<FileType type={file.type} icon={file.icon} aria-hidden="true" />
						<FileType type={file.type} icon={file.icon} variant="solid" aria-hidden="true" />
					</div>
					<span className="text-xs text-muted-foreground">{file.caption}</span>
				</li>
			))}
		</ul>
	);
}
