import * as React from "react";
import { UserAvatar } from "@workspace/ui/components/user-avatar";
import type { ResponsiveImage } from "@workspace/ui/lib/media/image-sources";

const PORTRAIT_URL = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80";
const AVATAR_DRAWN_PX = 32;

/** Only the 1,600 px original. */
const FULL_SIZE: ResponsiveImage = { url: PORTRAIT_URL };

export function UserAvatarDont2Example(): React.JSX.Element {
	return <UserAvatar name="Grace Hopper" image={FULL_SIZE} drawnSize={AVATAR_DRAWN_PX} className="size-8" />;
}
