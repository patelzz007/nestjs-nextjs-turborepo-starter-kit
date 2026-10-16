import * as React from "react";
import { CloudDownloadIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button14Example(): React.JSX.Element {
	return (
		<Button>
			<CloudDownloadIcon aria-hidden="true" />
			Download
		</Button>
	);
}
