import * as React from "react";
import { EntityAvatar } from "@workspace/ui/components/entity-avatar";

export function EntityAvatarDont1Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2 text-sm">
			<EntityAvatar name="Acme Coffee" size="lg" className="bg-pink-500 text-white" />
			Acme Coffee
		</div>
	);
}
