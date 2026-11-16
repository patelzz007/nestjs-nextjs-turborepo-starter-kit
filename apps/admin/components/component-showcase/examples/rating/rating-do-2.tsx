import * as React from "react";
import { Rating } from "@workspace/ui/components/rating";

export function RatingDo2Example(): React.JSX.Element {
	const [rating, setRating] = React.useState(0);
	return <Rating rating={rating} editable onRatingChange={setRating} size="lg" aria-label="Rate your stay" />;
}
