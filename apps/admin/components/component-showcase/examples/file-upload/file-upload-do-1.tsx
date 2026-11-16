import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { UploadIcon } from "lucide-react";

export function FileUploadDo1Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
			<UploadIcon aria-hidden="true" className="size-5 text-muted-foreground" />
			<Button variant="outline" size="sm" aria-describedby="file-upload-do-1-limits">
				Choose files
			</Button>
			<p id="file-upload-do-1-limits" className="text-xs text-muted-foreground">
				PDF, PNG or JPG, up to 10 MB each.
			</p>
		</div>
	);
}
