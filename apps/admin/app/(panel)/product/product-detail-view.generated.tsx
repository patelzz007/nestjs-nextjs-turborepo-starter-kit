"use client";

import { stubApiMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { Product } from "@workspace/shared/schemas/domain/product.generated";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export interface ProductDetailViewProps {
	readonly id: string;
	readonly initialProduct?: Product;
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

export default function ProductDetailView({ id, initialProduct }: ProductDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	const initialQueryData = useMemo(
		() =>
			initialProduct !== undefined
				? {
						success: true as const,
						data: initialProduct,
						meta: stubApiMeta(),
					}
				: undefined,
		[initialProduct],
	);
	const detailQuery = api.product.detail.useQuery({ id }, { initialData: initialQueryData });
	const entity: Product | undefined = detailQuery.data?.data;

	if (detailQuery.isLoading && entity === undefined) {
		return <p className="text-muted-foreground">Loading product…</p>;
	}

	if (detailQuery.isError || entity === undefined) {
		return (
			<div className="space-y-4">
				<Button variant="outline" nativeButton={false} render={<Link href="/product" />}>
					<ArrowLeft className="mr-2 size-4" />
					Back to products
				</Button>
				<p className="text-destructive">Could not load this product.</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Button variant="outline" nativeButton={false} render={<Link href="/product" />}>
					<ArrowLeft className="mr-2 size-4" />
					Back to products
				</Button>
				<Button nativeButton={false} render={<Link href={`/product/${entity.id}/edit`} />}>
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
					<div className="flex flex-wrap gap-2">
						{entity.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
						{entity.isFeatured ? <Badge variant="outline">Featured</Badge> : null}
					</div>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<DetailField label="ID" value={entity.id} />
					<DetailField label="Brand" value={entity.brand ?? "—"} />
					<DetailField label="Category Id" value={String(entity.categoryId)} />
					<DetailField label="Compare At Price" value={entity.compareAtPrice !== null && Number.isFinite(entity.compareAtPrice) ? entity.compareAtPrice.toFixed(2) : "—"} />
					<DetailField label="Description" value={entity.description ?? "—"} />
					<DetailField label="Image Url" value={entity.imageUrl ?? "—"} />
					<DetailField label="Is Active" value={entity.isActive ? "Yes" : "No"} />
					<DetailField label="Is Featured" value={entity.isFeatured ? "Yes" : "No"} />
					<DetailField label="Price" value={Number.isFinite(entity.price) ? entity.price.toFixed(2) : "—"} />
					<DetailField label="Short Description" value={entity.shortDescription ?? "—"} />
					<DetailField label="Sku" value={String(entity.sku)} />
					<DetailField label="Stock Quantity" value={String(entity.stockQuantity)} />
					<DetailField label="Weight Grams" value={entity.weightGrams !== null ? String(entity.weightGrams) : "—"} />
					<DetailField label="Created" value={formatEpoch(entity.createdAt)} />
					<DetailField label="Updated" value={formatEpoch(entity.updatedAt)} />
				</CardContent>
			</Card>
		</div>
	);
}
