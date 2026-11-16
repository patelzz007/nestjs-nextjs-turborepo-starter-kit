import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

export function Spinner2Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center justify-center gap-4">
			<Button>
				<Spinner data-icon="inline-start" /> Processing…
			</Button>
			<Button variant="outline" disabled>
				<Spinner data-icon="inline-start" /> Loading…
			</Button>
			<Button variant="outline" size="icon" disabled aria-label="Loading">
				<Spinner />
			</Button>
		</div>
	);
}
