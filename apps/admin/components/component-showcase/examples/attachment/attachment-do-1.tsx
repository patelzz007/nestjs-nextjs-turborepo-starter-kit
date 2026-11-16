import * as React from "react";
import { Attachment, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@workspace/ui/components/attachment";
import { FileTextIcon } from "lucide-react";

export function AttachmentDo1Example(): React.JSX.Element {
	return (
		<Attachment className="w-full max-w-sm">
			<AttachmentMedia>
				<FileTextIcon aria-hidden="true" />
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>retention-cohorts-q3.pdf</AttachmentTitle>
				<AttachmentDescription>PDF · 1.9 MB</AttachmentDescription>
			</AttachmentContent>
		</Attachment>
	);
}
