import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { EmptyState } from "@workspace/ui-native/components/empty";
import UserPlusIcon from "lucide-react-native/icons/user-plus";
import UsersIcon from "lucide-react-native/icons/users";
import * as React from "react";

import { ignorePress } from "../example-support";

const TITLE = "Team Members";
const DESCRIPTION = "Manage your team and their permissions.";

export function Empty8Example(): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
				<CardDescription>{DESCRIPTION}</CardDescription>
			</CardHeader>
			<CardContent>
				<EmptyState variant="plain" align="center" icon={UsersIcon} title="No team members" message="Invite people to collaborate on this project.">
					<Button label="Invite People" size="sm" icon={UserPlusIcon} onPress={ignorePress} />
				</EmptyState>
			</CardContent>
		</Card>
	);
}
