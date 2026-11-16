import { Button } from "@workspace/ui-native/components/button";
import { Field, FieldSet } from "@workspace/ui-native/components/field";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import { Switch } from "@workspace/ui-native/components/switch";
import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

export function Field7Example(): React.JSX.Element {
	const [slug, setSlug] = React.useState<string>("avery chen");
	const [bio, setBio] = React.useState<string>("");
	const [digest, setDigest] = React.useState<boolean>(true);
	const [mentions, setMentions] = React.useState<boolean>(false);
	const slugError = /^[a-z0-9-]+$/u.test(slug) ? undefined : "Use lower-case letters, digits and dashes only.";
	return (
		<View className="gap-5">
			<Field label="Profile URL" error={slugError}>
				<InputGroup value={slug} onChange={setSlug} leadingText="acme.com/" autoCapitalize="none" />
			</Field>
			<Field label="Bio" optional="optional" labelTrailing={<Text className="text-caption font-sans text-muted-foreground tabular-nums">{`${String(bio.length)}/160`}</Text>}>
				<Textarea value={bio} onChange={setBio} maxLength={160} />
			</Field>
			<FieldSet legend="Email">
				<Switch label="Weekly digest" checked={digest} onChange={setDigest} />
				<Switch label="Mentions" checked={mentions} onChange={setMentions} />
			</FieldSet>
			<Button label="Save profile" disabled={slugError !== undefined} onPress={ignorePress} />
		</View>
	);
}
