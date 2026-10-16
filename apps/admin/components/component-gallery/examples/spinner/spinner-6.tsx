import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

export function Spinner6Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-3">
			<Button disabled>
				<Spinner />
				Saving...
			</Button>
			<Button variant="outline" disabled>
				<Spinner />
				Loading
			</Button>
			<Button variant="secondary" disabled>
				<Spinner />
				Processing
			</Button>
		</div>
	);
}
