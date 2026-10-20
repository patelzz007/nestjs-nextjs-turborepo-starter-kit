// An avatar: a person's picture (or a tenant's logo) when there is one,
// otherwise the initials of the name. Presentational: the caller passes the
// name and the image URL it got from the API.
//
// One component covers both of the web kit's avatars: `shape="circle"` (the
// default) is the web's UserAvatar — a person; `shape="rounded"` is the web's
// EntityAvatar — a shop, tenant or team.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Image, Text, View, type ImageURISource } from "react-native";

import { cn } from "../lib/cn";

export const avatarVariants = cva("shrink-0 items-center justify-center overflow-hidden", {
	variants: {
		/** `lg` heads an account (profile, drawer); `md` leads a list row (a contributor); `sm` sits inline with text (a commit's author). */
		size: { sm: "size-6", md: "size-8", lg: "size-14" },
		/** `circle`: a person. `rounded`: a tenant, a shop, a team (its logo). */
		shape: { circle: "rounded-full", rounded: "" },
	},
	compoundVariants: [
		{ shape: "rounded", size: "sm", className: "rounded-md" },
		{ shape: "rounded", size: "md", className: "rounded-lg" },
		{ shape: "rounded", size: "lg", className: "rounded-xl" },
	],
	defaultVariants: { size: "lg", shape: "circle" },
});

/** The initials fallback's fill: `inverse` sits on a `primary` surface (the drawer's account header). */
export const avatarFallbackVariants = cva("", {
	variants: {
		tone: { default: "bg-primary", inverse: "bg-primary-foreground" },
	},
	defaultVariants: { tone: "default" },
});

export const avatarInitialsVariants = cva("font-heading", {
	variants: {
		size: { sm: "text-xs", md: "text-sm", lg: "text-lg" },
		tone: { default: "text-primary-foreground", inverse: "text-primary" },
	},
	defaultVariants: { size: "lg", tone: "default" },
});

export type AvatarSize = NonNullable<VariantProps<typeof avatarVariants>["size"]>;
export type AvatarShape = NonNullable<VariantProps<typeof avatarVariants>["shape"]>;
export type AvatarTone = NonNullable<VariantProps<typeof avatarFallbackVariants>["tone"]>;

/** Side of the avatar per size, in points: the picture's drawn size (`size-6`, `size-8`, `size-14`). */
export const AVATAR_POINTS: Readonly<Record<AvatarSize, number>> = {
	sm: 24,
	md: 32,
	lg: 56,
};

export interface AvatarProps {
	readonly name: string;
	/** The picture or logo; `null` shows the initials. */
	readonly imageUrl: string | null;
	readonly tone?: AvatarTone;
	readonly size?: AvatarSize;
	readonly shape?: AvatarShape;
	/** Overrides the accessible name (defaults to "<name>'s profile picture" / "<name>'s initials"). */
	readonly accessibilityLabel?: string;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
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

export const Avatar = React.memo(
	React.forwardRef<View, AvatarProps>(function Avatar(
		{ name, imageUrl, tone = "default", size = "lg", shape = "circle", accessibilityLabel, className, testID },
		ref,
	): React.JSX.Element {
		const source = React.useMemo((): ImageURISource | null => (imageUrl === null ? null : { uri: imageUrl }), [imageUrl]);
		const frame = avatarVariants({ size, shape });
		const points = AVATAR_POINTS[size];

		if (source !== null) {
			return (
				<View ref={ref} testID={testID} className={cn(frame, "bg-muted", className)}>
					<Image source={source} accessibilityLabel={accessibilityLabel ?? `${name}'s profile picture`} width={points} height={points} className={frame} />
				</View>
			);
		}
		return (
			<View
				ref={ref}
				accessible
				accessibilityLabel={accessibilityLabel ?? `${name}'s initials`}
				testID={testID}
				className={cn(frame, avatarFallbackVariants({ tone }), className)}>
				<Text className={avatarInitialsVariants({ size, tone })}>{initialsOf(name)}</Text>
			</View>
		);
	}),
);
