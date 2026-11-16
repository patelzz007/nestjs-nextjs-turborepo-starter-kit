// Avatars stacked into a group (the web kit's `AvatarGroup` and `AvatarGroupCount`): each overlaps the one before,
// ringed in the background colour so the edges stay clear, and a chip at the end says how many more there are — a
// number ("+5") or a plus. `spread` lays them out apart (the web's hover fan: a phone has no hover, so the caller
// opens it, with a press). The group is one image for screen readers, named by `label` ("Ava, Leo and 5 others").
//
//   (A)(L)(M)(+5)        stacked
//   (A) (L) (M) (+5)     spread
import { cva, type VariantProps } from "class-variance-authority";
import PlusIcon from "lucide-react-native/icons/plus";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { AVATAR_POINTS, type AvatarSize } from "./avatar";
import { Icon } from "./icon";

export const avatarGroupItemVariants = cva("rounded-full border-2 border-background", {
	variants: {
		size: { xs: "-ml-1", sm: "-ml-1.5", md: "-ml-2", row: "-ml-3", lg: "-ml-4", xl: "-ml-4" },
		first: { true: "ml-0", false: "" },
		spread: { true: "ml-1", false: "" },
	},
	compoundVariants: [{ first: true, spread: true, className: "ml-0" }],
	defaultVariants: { size: "md", first: false, spread: false },
});

export const avatarGroupCountVariants = cva("items-center justify-center rounded-full border-2 border-background bg-muted", {
	variants: {
		size: { xs: "size-5", sm: "size-7", md: "size-9", row: "size-12", lg: "size-15", xl: "size-17" },
	},
	defaultVariants: { size: "md" },
});

export type AvatarGroupCountDisplay = "number" | "plus" | "none";

export interface AvatarGroupProps {
	/** The avatars, in order (the kit's `Avatar`, each at the group's size). */
	readonly children: React.ReactNode;
	/** The group's name for screen readers: who is in it ("Ava, Leo and 5 others"). */
	readonly label: string;
	/** How many more people than the avatars shown: the end chip's number. */
	readonly extra?: number | undefined;
	/** The end chip: the number of others, a plus, or none. Default `number` when there are others. */
	readonly countDisplay?: AvatarGroupCountDisplay | undefined;
	readonly size?: AvatarSize | undefined;
	/** Apart instead of overlapping (the web's hover fan). */
	readonly spread?: boolean | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

type AvatarGroupVariantProps = VariantProps<typeof avatarGroupItemVariants>;
export type AvatarGroupSize = NonNullable<AvatarGroupVariantProps["size"]>;

export const AvatarGroup = React.memo(
	React.forwardRef<ViewInstance, AvatarGroupProps>(function AvatarGroup(
		{ children, label, extra = 0, countDisplay, size = "md", spread = false, className, testID },
		ref,
	): React.JSX.Element {
		const avatars = React.Children.toArray(children);
		const display: AvatarGroupCountDisplay = countDisplay ?? (extra > 0 ? "number" : "none");
		return (
			<View ref={ref} accessible accessibilityRole="image" accessibilityLabel={label} testID={testID} className={cn("flex-row items-center", className)}>
				{avatars.map((avatar: React.ReactNode, position: number): React.JSX.Element => (
					<View key={React.isValidElement(avatar) && avatar.key !== null ? avatar.key : position} className={avatarGroupItemVariants({ size, first: position === 0, spread })}>
						{avatar}
					</View>
				))}
				{display === "none" ? null : (
					<View className={cn(avatarGroupCountVariants({ size }), spread ? "ml-1" : avatarGroupItemVariants({ size }))}>
						{display === "plus" ? (
							<Icon icon={PlusIcon} size={AVATAR_POINTS[size] < AVATAR_POINTS.md ? "xs" : "sm"} colorClassName="accent-muted-foreground" />
						) : (
							<Text className="text-caption font-sans-medium text-muted-foreground">{`+${String(extra)}`}</Text>
						)}
					</View>
				)}
			</View>
		);
	}),
);
