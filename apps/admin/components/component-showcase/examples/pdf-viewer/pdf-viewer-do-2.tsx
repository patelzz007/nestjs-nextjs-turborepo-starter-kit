import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";

export function PdfViewerDo2Example(): React.JSX.Element {
	return (
		<Empty className="w-full max-w-sm border">
			<EmptyHeader>
				<EmptyTitle>This preview can&apos;t show statement-june.pdf</EmptyTitle>
				<EmptyDescription>Download it to read it in your PDF app.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button>Download PDF</Button>
			</EmptyContent>
		</Empty>
	);
}
