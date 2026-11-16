import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Bubble } from "@workspace/ui-native/components/bubble";
import { Message } from "@workspace/ui-native/components/message";
import { View } from "react-native";

import { snippet } from "./code-block-sample";

const FETCH = snippet("fetch-user");

// A two-turn chat where the assistant's reply mixes text and a code block.
export function CodeBlock4Example(): React.JSX.Element {
	return (
		<View className="w-full gap-3">
			<Message variant="sent">
				<Bubble variant="sent" text="How do I fetch a user by id?" />
			</Message>
			<Message avatar={<Avatar name="Assistant" imageUrl={null} size="md" tone="soft" color="violet" />}>
				<Bubble tone="ghost" text="Call your API and check the status before reading the body:" />
				<CodeBlock code={FETCH.code} lines={FETCH.lines} language="TypeScript" size="sm" />
				<Bubble tone="ghost" text="It throws when the user does not exist, so wrap it in a try." />
			</Message>
		</View>
	);
}
