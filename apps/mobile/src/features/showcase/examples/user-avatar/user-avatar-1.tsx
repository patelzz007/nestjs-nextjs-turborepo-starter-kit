import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { View } from "react-native";

/** A portrait served in three renditions: the avatar shows the one sharp at its size on this screen. */
const PORTRAIT = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80";
const SOURCES = [
	{ width: 64, url: `${PORTRAIT}&w=64` },
	{ width: 128, url: `${PORTRAIT}&w=128` },
	{ width: 256, url: `${PORTRAIT}&w=256` },
];

// A user's photo from the rendition that fits, and the initials for someone without one.
export function UserAvatar1Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-3">
			<Avatar name="Grace Hopper" imageUrl={`${PORTRAIT}&w=256`} sources={SOURCES} size="row" />
			<Avatar name="Ada Lovelace" imageUrl={null} size="row" />
		</View>
	);
}
