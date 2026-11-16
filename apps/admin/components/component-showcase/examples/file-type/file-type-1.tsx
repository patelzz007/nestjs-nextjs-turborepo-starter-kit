import * as React from "react";
import { FileType, type FileTypeName } from "@workspace/ui/components/file-type";

const formats: readonly FileTypeName[] = ["pdf", "docx", "xlsx", "pptx", "jpg", "mp4", "mp3", "zip", "fig", "html"];

export function FileType1Example(): React.JSX.Element {
	// No captions: each icon names itself ("PDF file", "MP4 file"), so a screen
	// reader still hears every format.
	return (
		<div className="mx-auto grid w-fit grid-cols-5 gap-x-4 gap-y-6">
			{formats.map((type: FileTypeName): React.JSX.Element => (
				<FileType key={type} type={type} />
			))}
		</div>
	);
}
