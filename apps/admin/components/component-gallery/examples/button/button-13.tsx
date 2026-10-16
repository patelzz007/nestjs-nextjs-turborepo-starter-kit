import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

export function Button13Example(): React.JSX.Element {
	return (
		<Button disabled>
			<Spinner aria-hidden="true" />
			Please wait
		</Button>
	);
}
