import { ListGroup } from "@workspace/ui-native/components/list-group";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";

export function Switch8Example(): React.JSX.Element {
	const [profile, setProfile] = React.useState<boolean>(true);
	const [activity, setActivity] = React.useState<boolean>(false);
	const [messages, setMessages] = React.useState<boolean>(true);
	return (
		<ListGroup title="Privacy settings">
			<Switch label="Show my profile" checked={profile} onChange={setProfile} className="px-4" />
			<Switch label="Show my activity" checked={activity} onChange={setActivity} className="px-4" />
			<Switch label="Allow messages" checked={messages} onChange={setMessages} className="px-4" />
		</ListGroup>
	);
}
