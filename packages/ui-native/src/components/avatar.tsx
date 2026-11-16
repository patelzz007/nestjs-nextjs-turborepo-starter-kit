// An avatar: a person's picture (or a tenant's logo) when there is one,
// otherwise the initials of the name. Presentational: the caller passes the
// name and the image URL it got from the API.
//
// One component covers both of the web kit's avatars: `shape="circle"` (the
// default) is the web's UserAvatar — a person, its picture taken from the
// rendition that is sharp at its size (`sources`); `shape="rounded"` is the web's
// EntityAvatar — a shop, tenant or team, its logo contained on a plain tile and
// its monogram tinted from its name (`tone="name"`). A picture that fails to
// load falls back to the initials.

import { cva, type VariantProps } from "class-variance-authority";
import { getEntityAvatarTone, pickImageRendition, type EntityAvatarTone, type ImageSourceEntry } from "@workspace/shared";
import * as React from "react";
import { ActivityIndicator, Image, type ImageURISource, PixelRatio, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";

export const avatarVariants = cva("shrink-0 items-center justify-center overflow-hidden", {
	variants: {
		/** `lg` heads an account (profile, drawer); `md` leads a list row (a contributor); `sm` sits inline with text (a commit's author). */
		/** `row`: a list row's lead picture (a notification), between a chip's `md` and a profile's `lg`. */
		size: { xs: "size-4", sm: "size-6", md: "size-8", row: "size-11", lg: "size-14", xl: "size-16" },
		/** `circle`: a person. `rounded`: a tenant, a shop, a team (its logo). */
		shape: { circle: "rounded-full", rounded: "" },
	},
	compoundVariants: [
		{ shape: "rounded", size: "xs", className: "rounded-sm" },
		{ shape: "rounded", size: "xl", className: "rounded-2xl" },
		{ shape: "rounded", size: "sm", className: "rounded-md" },
		{ shape: "rounded", size: "md", className: "rounded-lg" },
		{ shape: "rounded", size: "row", className: "rounded-lg" },
		{ shape: "rounded", size: "lg", className: "rounded-xl" },
	],
	defaultVariants: { size: "lg", shape: "circle" },
});

/** The initials fallback's fill: `default` a soft grey disc with ink initials; `inverse` sits on a `primary` surface; `panel` on the sign-in panel's ink; `solid` is a filled ink disc. */
export const avatarFallbackVariants = cva("", {
	variants: {
		tone: { default: "bg-muted", inverse: "bg-primary-foreground", panel: "bg-auth-panel-foreground", solid: "bg-primary", name: "", soft: "", filled: "" },
	},
	defaultVariants: { tone: "default" },
});

export const avatarInitialsVariants = cva("font-heading", {
	variants: {
		size: { xs: "text-caption", sm: "text-caption", md: "text-body", row: "text-body-lg", lg: "text-h3", xl: "text-h2" },
		tone: { default: "text-foreground", inverse: "text-primary", panel: "text-auth-panel", solid: "text-primary-foreground", name: "text-foreground", soft: "", filled: "" },
	},
	defaultVariants: { size: "lg", tone: "default" },
});

/** `tone="name"`: the monogram on a chart tint picked from the name (the web's EntityAvatar), the same name always the same colour. */
export const avatarNameToneVariants = cva("", {
	variants: {
		tint: { "chart-1": "bg-chart-1/20", "chart-2": "bg-chart-2/20", "chart-3": "bg-chart-3/20", "chart-4": "bg-chart-4/20" } satisfies Record<EntityAvatarTone, string>,
	},
	defaultVariants: { tint: "chart-1" },
});

/** A colour for `tone="soft"` (a tinted fill, a matching border) or `tone="filled"` (a full-strength fill), and for rings and badges. */
export type AvatarColor = "primary" | "success" | "warning" | "destructive" | "info" | "violet";

export const avatarColorVariants = cva("", {
	variants: {
		fill: { soft: "border", filled: "" },
		color: { primary: "", success: "", warning: "", destructive: "", info: "", violet: "" },
	},
	compoundVariants: [
		{ fill: "soft", color: "primary", className: "bg-primary-subtle border-primary/30" },
		{ fill: "soft", color: "success", className: "border-tone-green/30 bg-tone-green-soft" },
		{ fill: "soft", color: "warning", className: "border-tone-yellow/30 bg-tone-yellow-soft" },
		{ fill: "soft", color: "destructive", className: "border-tone-red/30 bg-tone-red-soft" },
		{ fill: "soft", color: "info", className: "border-tone-blue/30 bg-tone-blue-soft" },
		{ fill: "soft", color: "violet", className: "border-tone-violet/30 bg-tone-violet-soft" },
		{ fill: "filled", color: "primary", className: "bg-primary" },
		{ fill: "filled", color: "success", className: "bg-tone-green" },
		{ fill: "filled", color: "warning", className: "bg-tone-yellow" },
		{ fill: "filled", color: "destructive", className: "bg-tone-red" },
		{ fill: "filled", color: "info", className: "bg-tone-blue" },
		{ fill: "filled", color: "violet", className: "bg-tone-violet" },
	],
	defaultVariants: { fill: "soft", color: "primary" },
});

export const avatarColorTextVariants = cva("", {
	variants: {
		fill: { soft: "", filled: "text-white" },
		color: { primary: "", success: "", warning: "", destructive: "", info: "", violet: "" },
	},
	compoundVariants: [
		{ fill: "soft", color: "primary", className: "text-primary" },
		{ fill: "soft", color: "success", className: "text-tone-green" },
		{ fill: "soft", color: "warning", className: "text-tone-yellow" },
		{ fill: "soft", color: "destructive", className: "text-tone-red" },
		{ fill: "soft", color: "info", className: "text-tone-blue" },
		{ fill: "soft", color: "violet", className: "text-tone-violet" },
		{ fill: "filled", color: "primary", className: "text-primary-foreground" },
	],
	defaultVariants: { fill: "soft", color: "primary" },
});

/** A ring around the avatar, a background-coloured gap between them. */
export const avatarRingVariants = cva("rounded-full border-2 bg-background p-0.5", {
	variants: {
		color: {
			primary: "border-primary",
			success: "border-tone-green",
			warning: "border-tone-yellow",
			destructive: "border-tone-red",
			info: "border-tone-blue",
			violet: "border-tone-violet",
		},
		shape: { circle: "rounded-full", rounded: "rounded-xl" },
	},
	defaultVariants: { color: "primary", shape: "circle" },
});

/** Where a badge sits on the avatar. */
export type AvatarBadgePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export const avatarBadgeVariants = cva("absolute items-center justify-center rounded-full border-2 border-background", {
	variants: {
		position: { "top-left": "-top-0.5 -left-0.5", "top-right": "-top-0.5 -right-0.5", "bottom-left": "-bottom-0.5 -left-0.5", "bottom-right": "-right-0.5 -bottom-0.5" },
		kind: { dot: "size-3", icon: "size-5", count: "h-5 min-w-5 px-1" },
		color: { primary: "bg-primary", success: "bg-tone-green", warning: "bg-tone-yellow", destructive: "bg-tone-red", info: "bg-tone-blue", violet: "bg-tone-violet" },
	},
	defaultVariants: { position: "bottom-right", kind: "dot", color: "success" },
});

/** A badge on the avatar: a presence dot, an icon or a count, named for screen readers ("Online", "Verified", "3 unread"). */
export interface AvatarBadge {
	readonly label: string;
	readonly color?: AvatarColor | undefined;
	readonly position?: AvatarBadgePosition | undefined;
	readonly icon?: LucideIcon | undefined;
	readonly count?: number | undefined;
}

export type AvatarSize = NonNullable<VariantProps<typeof avatarVariants>["size"]>;
export type AvatarShape = NonNullable<VariantProps<typeof avatarVariants>["shape"]>;
export type AvatarTone = NonNullable<VariantProps<typeof avatarFallbackVariants>["tone"]>;

/** Side of the avatar per size, in points: the picture's drawn size (`size-6`, `size-8`, `size-11`, `size-14`). */
export const AVATAR_POINTS: Readonly<Record<AvatarSize, number>> = {
	xs: 16,
	sm: 24,
	md: 32,
	row: 44,
	lg: 56,
	xl: 64,
};

export interface AvatarLabels {
	/** The name of the overlay while a new picture uploads: "Updating Ava's picture". */
	readonly updating: (name: string) => string;
}

/** Default copy; generic and overridable. */
export const DEFAULT_AVATAR_LABELS: AvatarLabels = {
	updating: (name: string): string => `Updating ${name}'s picture`,
};

const BUSY = { busy: true };

export interface AvatarProps {
	readonly name: string;
	/** The picture or logo; `null` shows the initials. */
	readonly imageUrl: string | null;
	/** The picture's renditions (smallest first or not): the one sharp at the avatar's size on this screen is shown. */
	readonly sources?: readonly ImageSourceEntry[] | undefined;
	readonly tone?: AvatarTone;
	readonly size?: AvatarSize;
	readonly shape?: AvatarShape;
	/** With `tone="soft"` or `tone="filled"`: the initials' fill colour. */
	readonly color?: AvatarColor | undefined;
	/** A ring around the avatar in this colour. */
	readonly ring?: AvatarColor | undefined;
	/** Badges on its corners. */
	readonly badges?: readonly AvatarBadge[] | undefined;
	/** A spinner over a veil: the picture is being replaced. */
	readonly loading?: boolean | undefined;
	readonly labels?: AvatarLabels | undefined;
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
	React.forwardRef<ViewInstance, AvatarProps>(function Avatar(
		{
			name,
			imageUrl,
			sources,
			tone = "default",
			size = "lg",
			shape = "circle",
			color = "primary",
			ring,
			badges = [],
			loading = false,
			labels = DEFAULT_AVATAR_LABELS,
			accessibilityLabel,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const points = AVATAR_POINTS[size];
		const source = React.useMemo(
			(): ImageURISource | null => (imageUrl === null ? null : { uri: pickImageRendition({ url: imageUrl, sources }, PixelRatio.getPixelSizeForLayoutSize(points)) }),
			[imageUrl, points, sources],
		);
		const [failed, setFailed] = React.useState<ImageURISource | null>(null);
		const fail = React.useCallback((): void => {
			setFailed(source);
		}, [source]);
		const frame = avatarVariants({ size, shape });

		const extras = ring !== undefined || badges.length > 0 || loading;
		let face: React.JSX.Element;
		if (source !== null && failed !== source) {
			// A logo (rounded) is contained on a plain tile, never cropped; a person's picture fills its circle.
			const logo = shape === "rounded";
			face = (
				<View
					ref={extras ? undefined : ref}
					testID={extras ? undefined : testID}
					className={cn(frame, logo ? "border border-border bg-background p-0.5" : "bg-muted", extras ? "" : className)}>
					<Image
						source={source}
						accessibilityLabel={accessibilityLabel ?? (logo ? `${name} logo` : `${name}'s profile picture`)}
						width={logo ? undefined : points}
						height={logo ? undefined : points}
						resizeMode={logo ? "contain" : "cover"}
						onError={fail}
						className={logo ? "size-full" : frame}
					/>
				</View>
			);
		} else {
			const coloured = tone === "soft" || tone === "filled";
			const fillClass = coloured
				? avatarColorVariants({ fill: tone, color })
				: tone === "name"
					? avatarNameToneVariants({ tint: getEntityAvatarTone(name) })
					: avatarFallbackVariants({ tone });
			face = (
				<View
					ref={extras ? undefined : ref}
					accessible
					accessibilityLabel={accessibilityLabel ?? `${name}'s initials`}
					testID={extras ? undefined : testID}
					className={cn(frame, fillClass, extras ? "" : className)}>
					<Text className={cn(avatarInitialsVariants({ size, tone }), coloured ? avatarColorTextVariants({ fill: tone, color }) : "")}>{initialsOf(name)}</Text>
				</View>
			);
		}
		if (!extras) {
			return face;
		}
		return (
			<View ref={ref} testID={testID} className={cn("self-start", className)}>
				<View className={ring === undefined ? "" : avatarRingVariants({ color: ring, shape })}>
					{face}
					{loading ? (
						<View
							accessible
							accessibilityLabel={labels.updating(name)}
							accessibilityState={BUSY}
							className={cn(frame, "absolute inset-0 items-center justify-center bg-background/60")}>
							<ActivityIndicator size="small" colorClassName="accent-foreground" />
						</View>
					) : null}
				</View>
				{badges.map((badge: AvatarBadge): React.JSX.Element => (
					<View
						key={`${badge.position ?? "bottom-right"}-${badge.label}`}
						accessible
						accessibilityLabel={badge.label}
						className={avatarBadgeVariants({
							position: badge.position,
							kind: badge.count === undefined ? (badge.icon === undefined ? "dot" : "icon") : "count",
							color: badge.color,
						})}>
						{badge.icon === undefined ? null : <Icon icon={badge.icon} size="xs" colorClassName="accent-white" />}
						{badge.count === undefined ? null : <Text className="text-caption font-sans-semibold text-white">{badge.count}</Text>}
					</View>
				))}
			</View>
		);
	}),
);
