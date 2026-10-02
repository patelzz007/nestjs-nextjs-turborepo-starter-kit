"use client";

import { initialDataOption, stubApiMeta, successEnvelope } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { PERMISSION, type SampleCategory } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ROUTES } from "@/lib/routes";

export interface SampleCategoryDetailViewProps {
	readonly id: string;
	readonly initialSampleCategory?: SampleCategory | undefined;
}

function formatEpoch(value: number): string {
	return new Date(value).toLocaleString();
}

function DetailField({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
	return (
		<div className="space-y-1">
			<div className="text-sm text-muted-foreground">{label}</div>
			<div className="font-medium break-all">{value}</div>
		</div>
	);
}

export default function SampleCategoryDetailView({ id, initialSampleCategory }: SampleCategoryDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	// GET /sample-category/:id needs READ, which the route guard enforces for this page
	// (lib/navigation/route-authorization.ts), so it is not repeated here.
	// PATCH /sample-category/:id needs UPDATE — a finer-grained check for the Edit link.
	const { can } = useAuthorization();
	const canUpdate = can(PERMISSION.SAMPLE_CATEGORY.UPDATE);
	const initialQueryData = useMemo(() => (initialSampleCategory !== undefined ? successEnvelope(initialSampleCategory, stubApiMeta()) : undefined), [initialSampleCategory]);
	const detailQuery = api.sampleCategory.detail.useQuery({ id }, initialDataOption(initialQueryData));
	const entity: SampleCategory | undefined = detailQuery.data?.data;

	if (detailQuery.isLoading && entity === undefined) {
		return <p className="text-muted-foreground">{"Loading samplecategory…"}</p>;
	}

	if (detailQuery.isError || entity === undefined) {
		return (
			<div className="space-y-4">
				<Link href={ROUTES.catalog.categories.list} className={buttonVariants({ variant: "outline" })}>
					<ArrowLeft className="mr-2 size-4" />
					{"Back to categories"}
				</Link>
				<p className="text-destructive">{"Could not load this samplecategory."}</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Link href={ROUTES.catalog.categories.list} className={buttonVariants({ variant: "outline" })}>
					<ArrowLeft className="mr-2 size-4" />
					{"Back to categories"}
				</Link>
				{canUpdate ? (
					<Link href={ROUTES.catalog.categories.edit(entity.id)} className={buttonVariants()}>
						<Pencil className="mr-2 size-4" />
						Edit
					</Link>
				) : null}
			</div>

			<Card>
				<CardHeader className="flex flex-row items-start justify-between gap-4">
					<div className="space-y-1">
						<CardTitle>{entity.name}</CardTitle>
						<p className="text-sm text-muted-foreground">{entity.slug}</p>
					</div>
					<div className="flex flex-wrap gap-2">{entity.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</div>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<DetailField label="ID" value={entity.id} />
					<DetailField label="Description" value={entity.description ?? "—"} />
					<DetailField label="Is Active" value={entity.isActive ? "Yes" : "No"} />
					<DetailField label="Sort Order" value={String(entity.sortOrder)} />
					<DetailField label="Created" value={formatEpoch(entity.createdAt)} />
					<DetailField label="Updated" value={formatEpoch(entity.updatedAt)} />
				</CardContent>
			</Card>
		</div>
	);
}
