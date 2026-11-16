import * as React from "react";
import { FileIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";

export function Empty5Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Recent Documents</CardTitle>
					<CardDescription>A list of your recently opened documents.</CardDescription>
				</CardHeader>
				<CardContent>
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<FileIcon />
							</EmptyMedia>
							<EmptyTitle>No documents yet</EmptyTitle>
							<EmptyDescription>You haven&apos;t opened any documents recently.</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button size="sm">Create Document</Button>
						</EmptyContent>
					</Empty>
				</CardContent>
			</Card>
		</div>
	);
}
