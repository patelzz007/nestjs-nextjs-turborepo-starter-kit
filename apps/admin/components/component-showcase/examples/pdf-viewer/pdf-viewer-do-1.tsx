import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { FileTextIcon } from "lucide-react";

export function PdfViewerDo1Example(): React.JSX.Element {
	return (
		<Button variant="outline">
			<FileTextIcon aria-hidden="true" />
			Open statement-june.pdf (2 pages, 84 KB)
		</Button>
	);
}
