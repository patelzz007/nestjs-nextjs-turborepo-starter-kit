import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

export function SpinnerDont2Example(): React.JSX.Element {
	return (
		<Button>
			<Spinner aria-hidden="true" />
			Saving…
		</Button>
	);
}
