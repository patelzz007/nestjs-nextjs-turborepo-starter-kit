import * as React from "react";
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentMedia,
	AttachmentTitle,
} from "@workspace/ui/components/attachment";
import { FileTextIcon, RotateCwIcon } from "lucide-react";

export function AttachmentDo2Example(): React.JSX.Element {
	return (
		<Attachment state="error" className="w-full max-w-sm">
			<AttachmentMedia>
				<FileTextIcon aria-hidden="true" />
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>site-survey.mp4</AttachmentTitle>
				<AttachmentDescription>Upload failed · 48 MB</AttachmentDescription>
			</AttachmentContent>
			<AttachmentActions>
				<AttachmentAction type="button" aria-label="Retry uploading site-survey.mp4">
					<RotateCwIcon aria-hidden="true" />
				</AttachmentAction>
			</AttachmentActions>
		</Attachment>
	);
}
