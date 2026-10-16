import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Spinner } from "@workspace/ui/components/spinner";

export function Spinner3Example(): React.JSX.Element {
	return (
		<div className="grid grid-cols-3 gap-4">
			<Badge>
				<Spinner data-icon="inline-start" />
				Updating
			</Badge>
			<Badge variant="secondary">
				<Spinner data-icon="inline-start" />
				Syncing
			</Badge>
			<Badge variant="outline">
				<Spinner data-icon="inline-start" />
				Loading
			</Badge>
			<Badge variant="destructive-light">
				<Spinner data-icon="inline-start" />
				Updating
			</Badge>
			<Badge variant="success-light">
				<Spinner data-icon="inline-start" />
				Syncing
			</Badge>
			<Badge variant="info-light">
				<Spinner data-icon="inline-start" />
				Loading
			</Badge>
		</div>
	);
}
