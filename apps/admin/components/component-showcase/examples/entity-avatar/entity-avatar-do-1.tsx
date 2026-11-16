import * as React from "react";
import { EntityAvatar } from "@workspace/ui/components/entity-avatar";

export function EntityAvatarDo1Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2 text-sm">
			<EntityAvatar name="Acme Coffee" size="lg" />
			Acme Coffee
		</div>
	);
}
