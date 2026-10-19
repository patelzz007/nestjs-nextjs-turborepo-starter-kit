"use client";

import { RewardCategoryVisual } from "@/contexts/rewards/components/detail/category-visual";
import type { RewardResponse } from "@workspace/shared";
import { CoverImage } from "@workspace/ui/components/cover-image";
import { ImageCarousel } from "@workspace/ui/components/image-carousel";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";
import { REWARD_CARD_COVER_RATIO, REWARD_GALLERY_SIZES } from "@/contexts/rewards/lib/reward-cover";

export interface RewardGalleryProps {
	readonly reward: RewardResponse;
	/** Drawn in grey once the offer can no longer be claimed. */
	readonly muted?: boolean;
}

/**
 * The offer's photos, cover first: one photo as a frame, several as a
 * swipeable carousel. Each slide loads the rendition its width needs; the
 * first loads eagerly (the gallery leads the page).
 */
export function RewardGallery({ reward, muted = false }: RewardGalleryProps): React.JSX.Element {
	const frameClassName = cn("rounded-2xl border border-border", muted ? "grayscale" : undefined);
	if (reward.images.length === 0) {
		return (
			<CoverImage src={null} ratio={REWARD_CARD_COVER_RATIO} fallback={<RewardCategoryVisual category={reward.category} className="size-12" />} className={frameClassName} />
		);
	}
	return (
		<ImageCarousel
			images={reward.images.map((image, index) => ({
				id: image.fileId,
				src: image.url,
				sources: image.sources,
				alt: index === 0 ? `${reward.title} — cover photo` : "",
			}))}
			ratio={REWARD_CARD_COVER_RATIO}
			sizes={REWARD_GALLERY_SIZES}
			priority
			frameClassName={frameClassName}
			className="overflow-hidden rounded-2xl shadow-xs"
		/>
	);
}
