"use client";

import type { GeneratorUiModuleListItem, ResourceGeneratorListItem } from "@workspace/cli/generator";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { GeneratorDefinitionsTable } from "@/components/generator/generator-definitions-table";
import { GeneratorEnvironmentPanel } from "@/components/generator/generator-environment-panel";
import { Hammer, Plus, Terminal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface GeneratorHubProps {
	readonly resources: readonly ResourceGeneratorListItem[];
	readonly uiModules: readonly GeneratorUiModuleListItem[];
}

export function GeneratorHub({ resources, uiModules }: GeneratorHubProps): React.JSX.Element {
	const router = useRouter();

	const handleRollbackSuccess = React.useCallback((): void => {
		router.refresh();
	}, [router]);

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="grid gap-2">
					<div className="flex items-center gap-2">
						<Hammer className="size-6 text-primary" aria-hidden="true" />
						<h1 className="font-heading text-2xl font-semibold tracking-tight">Resource generator</h1>
						<Badge variant="secondary">dev only</Badge>
					</div>
					<p className="max-w-2xl text-sm text-muted-foreground">
						Scaffold new resources from the browser. Definitions are written to <code className="rounded bg-muted px-1">resources/definitions</code>, then API modules, shared
						contracts, and admin pages are generated automatically.
					</p>
				</div>
				<Button nativeButton={false} render={<Link href="/devtools/generator/new" />}>
					<Plus className="size-4" aria-hidden="true" />
					New resource
				</Button>
			</div>

			<GeneratorEnvironmentPanel initialModules={uiModules} />

			<Card>
				<CardHeader>
					<CardTitle>Registered definitions</CardTitle>
					<CardDescription>Resources already defined in the monorepo.</CardDescription>
				</CardHeader>
				<CardContent>
					<GeneratorDefinitionsTable resources={resources} onRollbackSuccess={handleRollbackSuccess} />
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Terminal className="size-4" aria-hidden="true" />
						After generation
					</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-2 text-sm text-muted-foreground">
					<p>
						1. Review Prisma changes in <code className="rounded bg-muted px-1">apps/api/prisma/schema.prisma</code>
					</p>
					<p>
						2. Run <code className="rounded bg-muted px-1">pnpm db:migrate</code>
					</p>
					<p>3. Restart dev servers if needed and open the new admin route</p>
				</CardContent>
			</Card>
		</div>
	);
}
