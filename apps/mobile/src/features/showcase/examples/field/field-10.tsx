import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { FieldSet } from "@workspace/ui-native/components/field";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { View } from "react-native";

export function Field10Example(): React.JSX.Element {
	const [push, setPush] = React.useState<boolean>(true);
	const [email, setEmail] = React.useState<boolean>(false);
	const [comments, setComments] = React.useState<boolean>(true);
	const [mentions, setMentions] = React.useState<boolean>(true);
	return (
		<View className="gap-6">
			<FieldSet legend="Channels" description="Where we reach you.">
				<Switch label="Push" checked={push} onChange={setPush} />
				<Switch label="Email" checked={email} onChange={setEmail} />
			</FieldSet>
			<FieldSet legend="Events">
				<Checkbox label="New comments" checked={comments} onChange={setComments} />
				<Checkbox label="Mentions" checked={mentions} onChange={setMentions} />
			</FieldSet>
		</View>
	);
}
