// A person's avatar: their picture when they have one, otherwise their initials.

import * as React from "react";
import { Image, Text, View } from "react-native";

export interface AvatarProps {
	readonly name: string;
	readonly imageUrl: string | null;
}

/** Side of the avatar, in points. */
const AVATAR_SIZE = 56;

const WHITESPACE_PATTERN = /\s+/;
const MAX_INITIALS = 2;

/** "Alex Morgan" → "AM"; one name → its first letter. */
export function initialsOf(name: string): string {
	return name
		.trim()
		.split(WHITESPACE_PATTERN)
		.filter((part: string): boolean => part.length > 0)
		.slice(0, MAX_INITIALS)
		.map((part: string): string => part.charAt(0).toUpperCase())
		.join("");
}

export function Avatar({ name, imageUrl }: AvatarProps): React.JSX.Element {
	if (imageUrl !== null) {
		return <Image source={{ uri: imageUrl }} accessibilityLabel={`${name}'s profile picture`} width={AVATAR_SIZE} height={AVATAR_SIZE} className="rounded-full" />;
	}
	return (
		<View accessibilityLabel={`${name}'s initials`} accessible className="size-14 items-center justify-center rounded-full bg-primary">
			<Text className="text-lg font-semibold text-primary-foreground">{initialsOf(name)}</Text>
		</View>
	);
}
