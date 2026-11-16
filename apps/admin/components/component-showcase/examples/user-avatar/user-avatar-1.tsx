import type * as React from "react";
import { UserAvatar } from "@workspace/ui/components/user-avatar";

/** The size the avatar is drawn at, so it can pick the right photo rendition. */
const AVATAR_DRAWN_PX = 40;
const PORTRAIT_URL = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=128&q=80";

export function UserAvatar1Example(): React.JSX.Element {
	return (
		<div className="flex items-center gap-3">
			<UserAvatar name="Grace Hopper" image={{ url: PORTRAIT_URL }} drawnSize={AVATAR_DRAWN_PX} className="size-10" />
			<UserAvatar name="Ada Lovelace" image={null} drawnSize={AVATAR_DRAWN_PX} className="size-10" />
		</div>
	);
}
