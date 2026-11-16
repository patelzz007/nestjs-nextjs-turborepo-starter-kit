import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { ListGroup } from "@workspace/ui-native/components/list-group";
import * as React from "react";

export function Checkbox10Example(): React.JSX.Element {
	const [comments, setComments] = React.useState<boolean>(true);
	const [mentions, setMentions] = React.useState<boolean>(true);
	const [follows, setFollows] = React.useState<boolean>(false);
	return (
		<ListGroup title="Notifications">
			<Checkbox label="Comments" checked={comments} onChange={setComments} controlPosition="end" className="px-4" />
			<Checkbox label="Mentions" checked={mentions} onChange={setMentions} controlPosition="end" className="px-4" />
			<Checkbox label="Follows" checked={follows} onChange={setFollows} controlPosition="end" className="px-4" />
		</ListGroup>
	);
}
