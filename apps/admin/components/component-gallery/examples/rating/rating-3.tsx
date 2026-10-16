import * as React from "react";
import { Rating } from "@workspace/ui/components/rating";

export function Rating3Example(): React.JSX.Element {
	return <Rating rating={4.5} showValue />;
}
