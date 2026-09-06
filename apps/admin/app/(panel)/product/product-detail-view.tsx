"use client";

import { useAuth } from "@workspace/client/lib/auth";
import type { Product } from "@workspace/shared/schemas/domain/product.generated";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";

export interface ProductDetailViewProps {
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

export default function ProductDetailView({ id }: ProductDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	const detailQuery = api.product.detail.useQuery({ id });
	const product: Product | undefined = detailQuery.data?.data;

	if (detailQuery.isLoading) {
		return <p className="text-muted-foreground">Loading product…</p>;
	}

	if (detailQuery.isError || product === undefined) {
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
				<Button nativeButton={false} render={<Link href={`/product/${product.id}/edit`} />}>
					<Pencil className="mr-2 size-4" />
					Edit
				</Button>
			</div>

			<Card>
				<CardHeader className="flex flex-row items-start justify-between gap-4">
					<div className="space-y-1">
						<CardTitle>{product.name}</CardTitle>
						<p className="text-sm text-muted-foreground">{product.sku}</p>
					</div>
					<div className="flex flex-wrap gap-2">
						{product.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
						{product.isFeatured ? <Badge variant="outline">Featured</Badge> : null}
					</div>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<DetailField label="ID" value={product.id} />
					<DetailField label="Slug" value={product.slug} />
					<DetailField label="Brand" value={product.brand ?? "—"} />
					<DetailField label="Category ID" value={product.categoryId} />
					<DetailField label="Price" value={product.price.toFixed(2)} />
					<DetailField label="Compare at" value={product.compareAtPrice !== null ? product.compareAtPrice.toFixed(2) : "—"} />
					<DetailField label="Stock" value={String(product.stockQuantity)} />
					<DetailField label="Weight (g)" value={product.weightGrams !== null ? String(product.weightGrams) : "—"} />
					<DetailField label="Short description" value={product.shortDescription ?? "—"} />
					<DetailField label="Description" value={product.description ?? "—"} />
					<DetailField label="Created" value={formatEpoch(product.createdAt)} />
					<DetailField label="Updated" value={formatEpoch(product.updatedAt)} />
				</CardContent>
			</Card>
		</div>
	);
}
