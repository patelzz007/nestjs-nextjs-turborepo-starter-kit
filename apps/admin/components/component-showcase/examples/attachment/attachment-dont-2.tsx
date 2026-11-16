import * as React from "react";
import { Attachment, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@workspace/ui/components/attachment";
import { FileTextIcon } from "lucide-react";

export function AttachmentDont2Example(): React.JSX.Element {
	return (
		<Attachment className="w-full max-w-sm">
			<AttachmentMedia>
				<FileTextIcon aria-hidden="true" />
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>site-survey.mp4</AttachmentTitle>
				<AttachmentDescription>MP4 · 48 MB</AttachmentDescription>
			</AttachmentContent>
		</Attachment>
	);
}
