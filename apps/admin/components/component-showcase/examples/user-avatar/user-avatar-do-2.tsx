import * as React from "react";
import { UserAvatar } from "@workspace/ui/components/user-avatar";
import type { ResponsiveImage } from "@workspace/ui/lib/media/image-sources";

const PORTRAIT_URL = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80";
const AVATAR_DRAWN_PX = 32;

/** The photo and its smaller renditions: a 32 px avatar fetches the 64 px one. */
const PORTRAIT: ResponsiveImage = {
	url: PORTRAIT_URL,
	sources: [
		{ width: 64, url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=64&q=80" },
		{ width: 256, url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=256&q=80" },
	],
};

export function UserAvatarDo2Example(): React.JSX.Element {
	return <UserAvatar name="Grace Hopper" image={PORTRAIT} drawnSize={AVATAR_DRAWN_PX} className="size-8" />;
}
