import { RewardCategorySchema, type RewardCategory } from "@workspace/shared";
import { Coffee, Heart, ShoppingBag, Sparkles, Store, Utensils, UtensilsCrossed } from "lucide-react";
import * as React from "react";

const CATEGORY_ICONS: Readonly<Record<RewardCategory, React.ComponentType<{ className?: string }>>> = {
	cafe: Coffee,
	restaurant: Utensils,
	retail: ShoppingBag,
	wellness: Heart,
	entertainment: Sparkles,
	food: UtensilsCrossed,
	beverage: Coffee,
};

export function getRewardCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
	const parsed = RewardCategorySchema.safeParse(category);
	if (parsed.success) return CATEGORY_ICONS[parsed.data];

	return Store;
}

export interface RewardCategoryVisualProps {
	readonly category: string;
	readonly className?: string;
}

/** Category glyph for reward cards and list rows. */
export function RewardCategoryVisual({ category, className }: RewardCategoryVisualProps): React.JSX.Element {
	const Icon = getRewardCategoryIcon(category);
	return <Icon className={className} aria-hidden="true" />;
}
