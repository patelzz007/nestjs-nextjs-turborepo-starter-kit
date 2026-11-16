import * as React from "react";
import { Attachment, AttachmentContent, AttachmentMedia, AttachmentTitle } from "@workspace/ui/components/attachment";
import { FileTextIcon } from "lucide-react";

export function AttachmentDont1Example(): React.JSX.Element {
	return (
		<Attachment className="w-full max-w-sm">
			<AttachmentMedia>
				<FileTextIcon aria-hidden="true" />
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>retention-cohorts-q3</AttachmentTitle>
			</AttachmentContent>
		</Attachment>
	);
}
