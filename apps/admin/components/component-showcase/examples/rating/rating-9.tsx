"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import { Rating } from "@workspace/ui/components/rating";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";

/** Ratings at or below this read as negative. */
const LOW_RATING = 2;
/** Ratings at or below this (and above \`LOW_RATING\`) read as neutral. */
const NEUTRAL_RATING = 3;

function feedbackFor(rating: number): string {
	if (rating <= LOW_RATING) {
		return "We're sorry to hear that";
	}
	if (rating <= NEUTRAL_RATING) {
		return "Thanks for your feedback";
	}
	return "Glad you enjoyed it!";
}

export function Rating9Example(): React.JSX.Element {
	const [rating, setRating] = useState(0);
	const [review, setReview] = useState("");

	const handleReviewChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setReview(event.target.value);
	}, []);

	return (
		<Card className="mx-auto w-full max-w-xs">
			<CardContent className="space-y-5">
				<div className="flex flex-col items-center gap-3">
					<h3 className="text-sm font-semibold">Write a Review</h3>
					<Rating rating={rating} onRatingChange={setRating} editable />
					{rating > 0 ? <p className="text-xs text-muted-foreground">{feedbackFor(rating)}</p> : null}
				</div>

				<div className="space-y-2">
					<Label htmlFor="review-text" className="text-sm">
						Your review
					</Label>
					<Textarea id="review-text" value={review} onChange={handleReviewChange} placeholder="Tell us what you think..." rows={3} />
				</div>

				<Button disabled={rating === 0} size="sm" className="w-full">
					Submit Review
				</Button>
			</CardContent>
		</Card>
	);
}
