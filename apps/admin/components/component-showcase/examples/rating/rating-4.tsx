"use client";

import { Rating } from "@workspace/ui/components/rating";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

/** The number of stars on the scale. */
const MAX_RATING = 5;

export function Rating4Example(): React.JSX.Element {
	const [productRating, setProductRating] = React.useState(0);

	const handleRatingChange = React.useCallback((rating: number): void => {
		setProductRating(rating);
		toastMessage.success({ title: "Thanks for rating", description: `Rated ${String(rating)} out of ${String(MAX_RATING)}` });
	}, []);

	return (
		<div className="space-y-8">
			<Rating rating={productRating} maxRating={MAX_RATING} editable onRatingChange={handleRatingChange} showValue />
		</div>
	);
}
