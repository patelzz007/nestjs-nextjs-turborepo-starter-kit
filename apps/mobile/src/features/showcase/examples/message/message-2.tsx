import { Avatar } from "@workspace/ui-native/components/avatar";
import { Bubble } from "@workspace/ui-native/components/bubble";
import { Message } from "@workspace/ui-native/components/message";
import * as React from "react";
import { View } from "react-native";

import { PORTRAITS } from "./message-sample";

/** A portrait with a green presence dot, named Online for screen readers. */
function Online({ name, uri }: { readonly name: string; readonly uri: string }): React.JSX.Element {
	return (
		<View>
			<Avatar name={name} imageUrl={uri} size="md" />
			<View accessible accessibilityLabel="Online" className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background bg-tone-green" />
		</View>
	);
}

// Photo avatars on both sides, a presence badge read as Online, and a long turn that wraps beside its avatar.
export function Message2Example(): React.JSX.Element {
	return (
		<View className="w-full gap-3">
			<Message avatar={<Online name="Ava Patel" uri={PORTRAITS.ava} />}>
				<Bubble text="I pushed the new onboarding copy. Could you look over the second screen when you have a minute? The tone shift there is deliberate but I want a second opinion." />
			</Message>
			<Message variant="sent" avatar={<Avatar name="Leo Kim" imageUrl={PORTRAITS.leo} size="md" />}>
				<Bubble variant="sent" text="On it now." />
			</Message>
		</View>
	);
}
