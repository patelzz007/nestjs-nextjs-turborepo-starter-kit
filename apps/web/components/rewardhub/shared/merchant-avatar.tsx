import { RewardCategoryVisual } from "@/components/rewardhub/detail/category-visual";
import type { RewardResponse } from "@workspace/shared";
import { EntityAvatar } from "@workspace/ui/components/display/entity-avatar";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export type RewardMerchantAvatarSize = "md" | "lg" | "xl";

/** Category-glyph tile for a reward whose merchant is unknown — matches the avatar footprint per size. */
const CATEGORY_TILE_CLASSES: Readonly<Record<RewardMerchantAvatarSize, { readonly tile: string; readonly icon: string }>> = {
	md: { tile: "size-10 rounded-lg", icon: "size-4" },
	lg: { tile: "size-12 rounded-xl", icon: "size-5" },
	xl: { tile: "size-16 rounded-xl", icon: "size-7" },
};

export interface RewardMerchantAvatarProps {
	readonly reward: Pick<RewardResponse, "organizationName" | "organizationLogoUrl" | "category">;
	readonly size: RewardMerchantAvatarSize;
	readonly className?: string;
}

/**
 * Who is offering a reward, at a glance: the merchant's logo, or a monogram of
 * the shop name while it has none. Decorative (`alt=""`) — every caller renders
 * the shop name as adjacent text, so it is not announced twice. A reward
 * without merchant context falls back to its category glyph.
 */
export function RewardMerchantAvatar({ reward, size, className }: RewardMerchantAvatarProps): React.JSX.Element {
	if (reward.organizationName !== undefined) {
		return <EntityAvatar name={reward.organizationName} src={reward.organizationLogoUrl} alt="" size={size} className={className} />;
	}

	const classes = CATEGORY_TILE_CLASSES[size];
	return (
		<div className={cn("flex shrink-0 items-center justify-center border border-border bg-secondary text-primary", classes.tile, className)}>
			<RewardCategoryVisual category={reward.category} className={classes.icon} />
		</div>
	);
}
