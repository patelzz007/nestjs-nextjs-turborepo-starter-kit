import * as React from "react";
import { UserAvatar } from "@workspace/ui/components/user-avatar";

const AVATAR_DRAWN_PX = 32;

export function UserAvatarDont1Example(): React.JSX.Element {
	return <UserAvatar name="Ada Lovelace" image={null} drawnSize={AVATAR_DRAWN_PX} className="size-8" />;
}
