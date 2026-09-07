"use client";

import { stubApiMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { SampleCategory } from "@workspace/shared/schemas/domain/sample-category.generated";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export interface SampleCategoryDetailViewProps {
	readonly id: string;
	readonly initialSampleCategory?: SampleCategory;
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
	const initialQueryData = useMemo(
		() =>
			initialSampleCategory !== undefined
				? {
						success: true as const,
						data: initialSampleCategory,
						meta: stubApiMeta(),
					}
				: undefined,
		[initialSampleCategory],
	);
	const detailQuery = api.sampleCategory.detail.useQuery({ id }, { initialData: initialQueryData });
	const entity: SampleCategory | undefined = detailQuery.data?.data;

	if (detailQuery.isLoading && entity === undefined) {
		return <p className="text-muted-foreground">Loading samplecategory…</p>;
	}

	if (detailQuery.isError || entity === undefined) {
		return (
			<div className="space-y-4">
				<Button variant="outline" nativeButton={false} render={<Link href="/sample-category" />}>
					<ArrowLeft className="mr-2 size-4" />
					Back to categories
				</Button>
				<p className="text-destructive">Could not load this samplecategory.</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Button variant="outline" nativeButton={false} render={<Link href="/sample-category" />}>
					<ArrowLeft className="mr-2 size-4" />
					Back to categories
				</Button>
				<Button nativeButton={false} render={<Link href={`/sample-category/${entity.id}/edit`} />}>
					<Pencil className="mr-2 size-4" />
					Edit
				</Button>
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
