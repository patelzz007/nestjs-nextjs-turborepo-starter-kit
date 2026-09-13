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
	const parsed = RewardCategorySchema.safeParse(category);

	switch (parsed.success ? parsed.data : null) {
		case "cafe":
			return <Coffee className={className} aria-hidden="true" />;
		case "restaurant":
			return <Utensils className={className} aria-hidden="true" />;
		case "retail":
			return <ShoppingBag className={className} aria-hidden="true" />;
		case "wellness":
			return <Heart className={className} aria-hidden="true" />;
		case "entertainment":
			return <Sparkles className={className} aria-hidden="true" />;
		case "food":
			return <UtensilsCrossed className={className} aria-hidden="true" />;
		case "beverage":
			return <Coffee className={className} aria-hidden="true" />;
		default:
			return <Store className={className} aria-hidden="true" />;
	}
}
