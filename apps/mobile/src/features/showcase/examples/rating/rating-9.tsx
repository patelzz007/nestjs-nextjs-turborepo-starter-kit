import { Button } from "@workspace/ui-native/components/button";
import { Field } from "@workspace/ui-native/components/field";
import { Rating } from "@workspace/ui-native/components/rating";
import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

/** What the card says back for each score, 0 to 5. */
const REPLIES: readonly string[] = ["Tap a star to rate.", "Sorry it went badly.", "Sorry it fell short.", "Thanks, noted.", "Glad you liked it.", "Wonderful, thank you!"];

export function Rating9Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(0);
	const [comment, setComment] = React.useState<string>("");
	return (
		<View className="gap-3">
			<Rating value={value} onChange={setValue} size="lg" accessibilityLabel="Your rating" />
			<Text className="text-body font-sans text-foreground">{REPLIES.at(Math.ceil(value)) ?? ""}</Text>
			<Field label="Comment" optional="optional">
				<Textarea value={comment} onChange={setComment} size="sm" />
			</Field>
			<Button label="Post review" disabled={value === 0} onPress={ignorePress} />
		</View>
	);
}
