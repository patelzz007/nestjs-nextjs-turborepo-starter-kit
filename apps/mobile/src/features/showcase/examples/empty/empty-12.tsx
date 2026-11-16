import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { EmptyState } from "@workspace/ui-native/components/empty";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import PlusIcon from "lucide-react-native/icons/plus";
import * as React from "react";

import { ignorePress } from "../example-support";

const TITLE = "Tasks";
const DESCRIPTION = "Track and manage your to-dos.";

export function Empty12Example(): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
				<CardDescription>{DESCRIPTION}</CardDescription>
			</CardHeader>
			<CardContent>
				<EmptyState variant="plain" align="center" icon={CircleCheckIcon} title="All clear" message="You have no pending tasks. Enjoy the downtime or create a new one.">
					<Button label="New Task" variant="outline" size="sm" icon={PlusIcon} onPress={ignorePress} />
				</EmptyState>
			</CardContent>
		</Card>
	);
}
