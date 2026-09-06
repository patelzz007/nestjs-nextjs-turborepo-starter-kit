"use client";

import { useAuth } from "@workspace/client/lib/auth";
import type { SampleCategory } from "@workspace/shared/schemas/domain/sample-category.generated";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";

export interface SampleCategoryDetailViewProps {
	readonly id: string;
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

export default function SampleCategoryDetailView({ id }: SampleCategoryDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	const detailQuery = api.sampleCategory.detail.useQuery({ id });
	const category: SampleCategory | undefined = detailQuery.data?.data;

	if (detailQuery.isLoading) {
		return <p className="text-muted-foreground">Loading category…</p>;
	}

	if (detailQuery.isError || category === undefined) {
		return (
			<div className="space-y-4">
				<Button variant="outline" nativeButton={false} render={<Link href="/sample-category" />}>
					<ArrowLeft className="mr-2 size-4" />
					Back to categories
				</Button>
				<p className="text-destructive">Could not load this category.</p>
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
				<Button nativeButton={false} render={<Link href={`/sample-category/${category.id}/edit`} />}>
					<Pencil className="mr-2 size-4" />
					Edit
				</Button>
			</div>

			<Card>
				<CardHeader className="flex flex-row items-start justify-between gap-4">
					<div className="space-y-1">
						<CardTitle>{category.name}</CardTitle>
						<p className="text-sm text-muted-foreground">{category.slug}</p>
					</div>
					{category.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<DetailField label="ID" value={category.id} />
					<DetailField label="Sort order" value={String(category.sortOrder)} />
					<DetailField label="Description" value={category.description ?? "—"} />
					<DetailField label="Created" value={formatEpoch(category.createdAt)} />
					<DetailField label="Updated" value={formatEpoch(category.updatedAt)} />
				</CardContent>
			</Card>
		</div>
	);
}
