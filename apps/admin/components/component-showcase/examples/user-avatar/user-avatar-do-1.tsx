import * as React from "react";
import { UserAvatar } from "@workspace/ui/components/user-avatar";

const AVATAR_DRAWN_PX = 32;

export function UserAvatarDo1Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-2 text-sm">
			<UserAvatar name="Ada Lovelace" image={null} drawnSize={AVATAR_DRAWN_PX} className="size-8" />
			Ada Lovelace
		</div>
	);
}
