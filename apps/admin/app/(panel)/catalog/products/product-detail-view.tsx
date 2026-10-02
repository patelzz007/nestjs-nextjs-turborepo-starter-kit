"use client";

import { initialDataOption, stubApiMeta, successEnvelope } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { PERMISSION, type Product } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ROUTES } from "@/lib/routes";

export interface ProductDetailViewProps {
	readonly id: string;
	readonly initialProduct?: Product | undefined;
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
	// GET /product/:id needs READ, which the route guard enforces for this page
	// (lib/navigation/route-authorization.ts), so it is not repeated here.
	// PATCH /product/:id needs UPDATE — a finer-grained check for the Edit link.
	const { can } = useAuthorization();
	const canUpdate = can(PERMISSION.PRODUCT.UPDATE);
	const initialQueryData = useMemo(() => (initialProduct !== undefined ? successEnvelope(initialProduct, stubApiMeta()) : undefined), [initialProduct]);
	const detailQuery = api.product.detail.useQuery({ id }, initialDataOption(initialQueryData));
	const entity: Product | undefined = detailQuery.data?.data;

	if (detailQuery.isLoading && entity === undefined) {
		return <p className="text-muted-foreground">{"Loading product…"}</p>;
	}

	if (detailQuery.isError || entity === undefined) {
		return (
			<div className="space-y-4">
				<Link href={ROUTES.catalog.products.list} className={buttonVariants({ variant: "outline" })}>
					<ArrowLeft className="mr-2 size-4" />
					{"Back to products"}
				</Link>
				<p className="text-destructive">{"Could not load this product."}</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Link href={ROUTES.catalog.products.list} className={buttonVariants({ variant: "outline" })}>
					<ArrowLeft className="mr-2 size-4" />
					{"Back to products"}
				</Link>
				{canUpdate ? (
					<Link href={ROUTES.catalog.products.edit(entity.id)} className={buttonVariants()}>
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
					<div className="flex flex-wrap gap-2">
						{entity.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
						{entity.isFeatured ? <Badge variant="outline">Featured</Badge> : null}
					</div>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<DetailField label="ID" value={entity.id} />
					<DetailField label="Brand" value={entity.brand ?? "—"} />
					<DetailField label="Category Id" value={entity.categoryId} />
					<DetailField label="Compare At Price" value={entity.compareAtPrice !== null && Number.isFinite(entity.compareAtPrice) ? entity.compareAtPrice.toFixed(2) : "—"} />
					<DetailField label="Description" value={entity.description ?? "—"} />
					<DetailField label="Image Url" value={entity.imageUrl ?? "—"} />
					<DetailField label="Is Active" value={entity.isActive ? "Yes" : "No"} />
					<DetailField label="Is Featured" value={entity.isFeatured ? "Yes" : "No"} />
					<DetailField label="Price" value={Number.isFinite(entity.price) ? entity.price.toFixed(2) : "—"} />
					<DetailField label="Short Description" value={entity.shortDescription ?? "—"} />
					<DetailField label="Sku" value={entity.sku} />
					<DetailField label="Stock Quantity" value={String(entity.stockQuantity)} />
					<DetailField label="Weight Grams" value={entity.weightGrams !== null ? String(entity.weightGrams) : "—"} />
					<DetailField label="Created" value={formatEpoch(entity.createdAt)} />
					<DetailField label="Updated" value={formatEpoch(entity.updatedAt)} />
				</CardContent>
			</Card>
		</div>
	);
}
