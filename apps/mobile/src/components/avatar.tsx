// A person's avatar: their picture when they have one, otherwise their initials.

import * as React from "react";
import { Image, Text, View } from "react-native";

export type AvatarTone = "default" | "inverse";

/** Initials colours per tone: `inverse` sits on a `primary` surface (the drawer's account header). */
const TONE_CLASSES: Readonly<Record<AvatarTone, { readonly circle: string; readonly initials: string }>> = {
	default: { circle: "bg-primary", initials: "text-primary-foreground" },
	inverse: { circle: "bg-primary-foreground", initials: "text-primary" },
};

/** `lg` heads an account (profile, drawer); `sm` sits inline with text (a commit's author). */
export type AvatarSize = "sm" | "lg";

/** Side of the avatar per size, in points, and the classes of the initials fallback. */
const SIZES: Readonly<Record<AvatarSize, { readonly points: number; readonly circle: string; readonly initials: string }>> = {
	sm: { points: 24, circle: "size-6", initials: "text-xs" },
	lg: { points: 56, circle: "size-14", initials: "text-lg" },
};

export interface AvatarProps {
	readonly name: string;
	readonly imageUrl: string | null;
	readonly tone?: AvatarTone;
	readonly size?: AvatarSize;
}

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

export function Avatar({ name, imageUrl, tone = "default", size = "lg" }: AvatarProps): React.JSX.Element {
	const classes = TONE_CLASSES[tone];
	const dimensions = SIZES[size];
	if (imageUrl !== null) {
		return <Image source={{ uri: imageUrl }} accessibilityLabel={`${name}'s profile picture`} width={dimensions.points} height={dimensions.points} className="rounded-full" />;
	}
	return (
		<View accessibilityLabel={`${name}'s initials`} accessible className={`${dimensions.circle} items-center justify-center rounded-full ${classes.circle}`}>
			<Text className={`font-heading ${dimensions.initials} ${classes.initials}`}>{initialsOf(name)}</Text>
		</View>
	);
}
