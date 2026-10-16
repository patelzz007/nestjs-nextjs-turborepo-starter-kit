import * as React from "react";
import { CopyIcon, RotateCcwIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";

interface ApiKey {
	readonly name: string;
	readonly token: string;
	readonly permissions: readonly string[];
	readonly lastUsed: string;
	readonly status: string;
	readonly statusVariant: BadgeVariant;
}

const apiKeys: readonly ApiKey[] = [
	{
		name: "Production API",
		token: "sk_live_••••••••4f3a",
		permissions: ["read", "write"],
		lastUsed: "2 minutes ago",
		status: "Active",
		statusVariant: "success-light",
	},
	{
		name: "Staging API",
		token: "sk_test_••••••••8b2c",
		permissions: ["read", "write", "admin"],
		lastUsed: "1 hour ago",
		status: "Active",
		statusVariant: "success-light",
	},
	{
		name: "CI/CD Pipeline",
		token: "sk_ci_••••••••1d9e",
		permissions: ["read"],
		lastUsed: "3 days ago",
		status: "Active",
		statusVariant: "success-light",
	},
	{
		name: "Legacy Integration",
		token: "sk_old_••••••••7a5f",
		permissions: ["read", "write"],
		lastUsed: "30 days ago",
		status: "Expired",
		statusVariant: "destructive-light",
	},
];

const permissionVariant: Record<string, "outline" | "info-light" | "warning-light"> = {
	read: "outline",
	write: "info-light",
	admin: "warning-light",
};

export function Table12Example(): React.JSX.Element {
	return (
		<Card className="mx-auto flex w-full max-w-2xl p-0">
			<CardContent className="p-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Key</TableHead>
							<TableHead>Permissions</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{apiKeys.map((key) => (
							<TableRow key={key.name}>
								<TableCell>
									<div className="flex flex-col">
										<span className="text-sm font-medium">{key.name}</span>
										<span className="text-xs text-muted-foreground">Last used: {key.lastUsed}</span>
									</div>
								</TableCell>
								<TableCell>
									<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{key.token}</code>
								</TableCell>
								<TableCell>
									<div className="flex gap-1">
										{key.permissions.map((perm) => (
											<Badge key={perm} variant={permissionVariant[perm] ?? "outline"} size="xs">
												{perm}
											</Badge>
										))}
									</div>
								</TableCell>
								<TableCell>
									<Badge variant={key.statusVariant} size="sm">
										{key.status}
									</Badge>
								</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-1">
										<Button variant="ghost" size="icon" className="size-7">
											<CopyIcon className="size-3.5" aria-hidden="true" />
											<span className="sr-only">Copy key</span>
										</Button>
										<Button variant="ghost" size="icon" className="size-7">
											<RotateCcwIcon className="size-3.5" aria-hidden="true" />
											<span className="sr-only">Regenerate key</span>
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
