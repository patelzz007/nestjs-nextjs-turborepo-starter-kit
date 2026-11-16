import * as React from "react";
import { UserPlusIcon, UsersIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";

export function Empty8Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Team Members</CardTitle>
					<CardDescription>Manage your team and their permissions.</CardDescription>
				</CardHeader>
				<CardContent>
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<UsersIcon />
							</EmptyMedia>
							<EmptyTitle>No team members</EmptyTitle>
							<EmptyDescription>Invite people to collaborate on this project.</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button size="sm">
								<UserPlusIcon data-icon="inline-start" />
								Invite People
							</Button>
						</EmptyContent>
					</Empty>
				</CardContent>
			</Card>
		</div>
	);
}
