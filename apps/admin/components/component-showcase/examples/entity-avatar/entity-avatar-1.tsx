import type * as React from "react";
import { EntityAvatar } from "@workspace/ui/components/entity-avatar";

const MERCHANTS: readonly string[] = ["Acme Coffee", "Bayview Books", "Corner Bakery", "Delta Fitness"];

export function EntityAvatar1Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center gap-3">
			{MERCHANTS.map((name: string): React.JSX.Element => (
				<EntityAvatar key={name} name={name} size="lg" />
			))}
			<EntityAvatar name="Circle" size="lg" shape="circle" />
		</div>
	);
}
