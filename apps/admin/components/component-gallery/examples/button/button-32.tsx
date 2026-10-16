import * as React from "react";
import { Button } from "@workspace/ui/components/button";

export function Button32Example(): React.JSX.Element {
	return (
		<Button variant="outline" aria-invalid="true">
			Invalid Outline
		</Button>
	);
}
