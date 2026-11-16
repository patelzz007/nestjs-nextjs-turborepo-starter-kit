import { Rating } from "@workspace/ui-native/components/rating";
import * as React from "react";

export function RatingDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(0);
	return <Rating value={value} onChange={setValue} size="sm" accessibilityLabel="Your rating" />;
}
