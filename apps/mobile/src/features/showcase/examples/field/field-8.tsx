import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { FieldSet } from "@workspace/ui-native/components/field";
import * as React from "react";

import { ignorePress } from "../example-support";

interface Level {
	readonly label: string;
	readonly description: string;
	readonly ownerOnly: boolean;
}

const LEVELS: readonly Level[] = [
	{ label: "Read", description: "See every record.", ownerOnly: false },
	{ label: "Write", description: "Create and edit records.", ownerOnly: false },
	{ label: "Delete", description: "Remove records.", ownerOnly: false },
	{ label: "Admin", description: "Manage members and billing (owners only).", ownerOnly: true },
];

export function Field8Example(): React.JSX.Element {
	return (
		<FieldSet legend="Access" description="What the Editor role can do.">
			{LEVELS.map(({ label, description, ownerOnly }: Level): React.JSX.Element => (
				<Checkbox key={label} label={label} description={description} checked={!ownerOnly} locked={ownerOnly} onChange={ignorePress} variant="card" />
			))}
		</FieldSet>
	);
}
