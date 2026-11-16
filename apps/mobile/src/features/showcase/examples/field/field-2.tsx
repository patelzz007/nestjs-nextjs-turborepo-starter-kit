import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";
import { Text, View } from "react-native";

/** The longest message the ticket takes. */
const MAX = 500;

export function Field2Example(): React.JSX.Element {
	const [subject, setSubject] = React.useState<string>("");
	const [message, setMessage] = React.useState<string>("");
	return (
		<View className="gap-4">
			<Field label="Subject">
				<Input value={subject} onChange={setSubject} placeholder="What is it about?" />
			</Field>
			<Field label="Message" labelTrailing={<Text className="text-caption font-sans text-muted-foreground tabular-nums">{`${String(message.length)}/${String(MAX)}`}</Text>}>
				<Textarea value={message} onChange={setMessage} maxLength={MAX} placeholder="Tell us what happened" />
			</Field>
		</View>
	);
}
