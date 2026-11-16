import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";

const PORTRAIT = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80";

/** The 2,000-pixel original, for a 32-point circle. */
export function UserAvatarDont2Example(): React.JSX.Element {
	return <Avatar name="Grace Hopper" imageUrl={`${PORTRAIT}&w=2000`} size="md" />;
}
