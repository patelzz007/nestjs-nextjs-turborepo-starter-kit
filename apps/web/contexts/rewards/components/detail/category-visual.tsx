import { RewardCategorySchema, type RewardCategory } from "@workspace/shared";
import { Coffee, Heart, ShoppingBag, Sparkles, Store, Utensils, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type * as React from "react";

const CATEGORY_ICONS: Readonly<Record<RewardCategory, LucideIcon>> = {
	cafe: Coffee,
	restaurant: Utensils,
	retail: ShoppingBag,
	wellness: Heart,
	entertainment: Sparkles,
	food: UtensilsCrossed,
	beverage: Coffee,
};

export interface RewardCategoryVisualProps {
	readonly category: string;
	readonly className?: string;
}

/** Category glyph for reward cards and list rows. */
export function RewardCategoryVisual({ category, className }: RewardCategoryVisualProps): React.JSX.Element {
	const parsed = RewardCategorySchema.safeParse(category);
	const Icon = parsed.success ? CATEGORY_ICONS[parsed.data] : Store;

	return <Icon className={className} aria-hidden="true" />;
}
