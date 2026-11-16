import { Rating } from "@workspace/ui-native/components/rating";
import * as React from "react";

export function RatingDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(0);
	return <Rating value={value} onChange={setValue} size="lg" accessibilityLabel="Your rating" />;
}
