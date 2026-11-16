import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { EmptyState } from "@workspace/ui-native/components/empty";
import FileIcon from "lucide-react-native/icons/file";
import * as React from "react";

import { ignorePress } from "../example-support";

const TITLE = "Recent Documents";
const DESCRIPTION = "A list of your recently opened documents.";

export function Empty5Example(): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
				<CardDescription>{DESCRIPTION}</CardDescription>
			</CardHeader>
			<CardContent>
				<EmptyState variant="plain" align="center" icon={FileIcon} title="No documents yet" message="You haven't opened any documents recently.">
					<Button label="Create Document" size="sm" onPress={ignorePress} />
				</EmptyState>
			</CardContent>
		</Card>
	);
}
