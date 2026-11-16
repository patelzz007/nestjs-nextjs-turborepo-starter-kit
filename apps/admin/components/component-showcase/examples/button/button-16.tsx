import * as React from "react";
import { GitBranchIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button16Example(): React.JSX.Element {
	return (
		<Button variant="secondary">
			<GitBranchIcon aria-hidden="true" />
			Repository
		</Button>
	);
}
