import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { UploadIcon } from "lucide-react";

export function FileUploadDont1Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
			<UploadIcon aria-hidden="true" className="size-5 text-muted-foreground" />
			<Button variant="outline" size="sm">
				Choose files
			</Button>
		</div>
	);
}
