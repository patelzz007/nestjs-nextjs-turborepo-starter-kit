import * as React from "react";
import { CircleCheckIcon, PlusIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";

export function Empty12Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Tasks</CardTitle>
					<CardDescription>Track and manage your to-dos.</CardDescription>
				</CardHeader>
				<CardContent>
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<CircleCheckIcon />
							</EmptyMedia>
							<EmptyTitle>All clear</EmptyTitle>
							<EmptyDescription>You have no pending tasks. Enjoy the downtime or create a new one.</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button size="sm" variant="outline">
								<PlusIcon data-icon="inline-start" />
								New Task
							</Button>
						</EmptyContent>
					</Empty>
				</CardContent>
			</Card>
		</div>
	);
}
