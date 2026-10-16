import * as React from "react";
import { CheckSquareIcon, FileTextIcon, FolderIcon, UsersIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Card, CardContent } from "@workspace/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

export function Tabs8Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-lg flex-col gap-6">
			<Tabs defaultValue="projects" orientation="vertical" className="gap-5">
				<TabsList variant="line" className="w-48 shrink-0">
					<TabsTrigger value="projects" className="justify-start gap-2">
						<FolderIcon className="size-4" />
						Projects
						<Badge variant="secondary" size="sm" className="ml-auto">
							8
						</Badge>
					</TabsTrigger>
					<TabsTrigger value="tasks" className="justify-start gap-2">
						<CheckSquareIcon className="size-4" />
						Tasks
						<Badge variant="primary-light" size="sm" className="ml-auto">
							24
						</Badge>
					</TabsTrigger>
					<TabsTrigger value="team" className="justify-start gap-2">
						<UsersIcon className="size-4" />
						Team
					</TabsTrigger>
					<TabsTrigger value="reports" className="justify-start gap-2">
						<FileTextIcon className="size-4" />
						Reports
					</TabsTrigger>
				</TabsList>
				<TabsContent value="projects">
					<Card>
						<CardContent>
							<h3 className="mb-2 font-semibold text-foreground">Active Projects</h3>
							<p>8 projects are currently in progress across your workspace.</p>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="tasks">
					<Card>
						<CardContent>
							<h3 className="mb-2 font-semibold text-foreground">Pending Tasks</h3>
							<p>24 tasks need your attention this week.</p>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="team">
					<Card>
						<CardContent>
							<h3 className="mb-2 font-semibold text-foreground">Team Members</h3>
							<p>Manage your team and their access permissions.</p>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="reports">
					<Card>
						<CardContent>
							<h3 className="mb-2 font-semibold text-foreground">Reports</h3>
							<p>View generated reports and export data.</p>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
