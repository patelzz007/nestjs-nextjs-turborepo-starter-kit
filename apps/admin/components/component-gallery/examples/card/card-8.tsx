import * as React from "react";
import { Card } from "@workspace/ui/components/card";
import Image from "next/image";

import { CARD_PHOTO_HEIGHT, CARD_PHOTO_WIDTH, CARD_PHOTOS } from "@/components/component-gallery/examples/card/card-sample";

export function Card8Example(): React.JSX.Element {
	return (
		<Card className="group/card relative h-96 w-full max-w-xs overflow-hidden border-0 p-0!">
			<Image
				src={CARD_PHOTOS.waves}
				alt="Abstract sample photo"
				width={CARD_PHOTO_WIDTH}
				height={CARD_PHOTO_HEIGHT}
				className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover/card:scale-110"
			/>

			{/* Background fade effects */}
			<div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-scrim/60 to-transparent transition-opacity duration-500 group-hover/card:from-scrim/70" />

			{/* Content */}
			<div className="relative flex h-full flex-col justify-end p-6">
				<h3 className="text-xl font-bold text-status-foreground">Image Scale Effect</h3>
				<p className="mt-2 text-sm text-status-foreground/90">This card features a smooth image scaling effect and background overlay on hover.</p>
			</div>
		</Card>
	);
}
