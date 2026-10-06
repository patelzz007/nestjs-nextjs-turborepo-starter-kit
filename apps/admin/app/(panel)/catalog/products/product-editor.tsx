"use client";

import { useQueryClient } from "@tanstack/react-query";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/auth";
import { ApiErrorCodes, type CreateProductInput, type Envelope, type Product } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import { useRouter } from "next/navigation";
import * as React from "react";

import { ProductForm } from "@/components/catalog/product-form";
import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";
import { EMPTY_PRODUCT_FORM_VALUES, toProductFormValues } from "@/lib/catalog/form-values";
import { ROUTES } from "@/lib/routes";

/** `PATCH /product/:id` answers CONFLICT when the product changed since it was loaded (optimistic lock). */
const UPDATE_PRODUCT_ERROR_MESSAGES: MutationErrorMessages = {
	[ApiErrorCodes.CONFLICT]: "Someone else changed this product while you were editing. Reload the page to edit the latest version.",
};

/** Refreshes every product list and this product's detail after a write. */
function useInvalidateProduct(): (productId: string) => Promise<void> {
	const queryClient = useQueryClient();
	return React.useCallback(
		async (productId: string): Promise<void> => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: apiRouter.product.list.scopeKey(undefined) }),
				queryClient.invalidateQueries({ queryKey: apiRouter.product.detail.scopeKey({ id: productId }) }),
			]);
		},
		[queryClient],
	);
}

/** `/catalog/products/new` — `POST /product`, then the new product's page. */
export function CreateProductView(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const invalidateProduct = useInvalidateProduct();
	const createProduct = api.product.create.useMutation({
		onSuccess: async (response) => {
			await invalidateProduct(response.data.id);
			toastMessage.success({ title: "Product created", description: response.data.name });
			router.push(ROUTES.catalog.products.detail(response.data.id));
		},
		onError: (error) => {
			toastMutationError("Could not create the product", error);
		},
	});

	const handleSubmit = React.useCallback(
		(input: CreateProductInput): void => {
			createProduct.mutate(input);
		},
		[createProduct],
	);

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-semibold">New product</h1>
			<ProductForm
				initialValues={EMPTY_PRODUCT_FORM_VALUES}
				submitLabel="Create product"
				isPending={createProduct.isPending}
				onSubmit={handleSubmit}
				cancelHref={ROUTES.catalog.products.list}
			/>
		</div>
	);
}

export interface EditProductViewProps {
	readonly id: string;
	/** The server-prefetched `GET /product/:id` envelope, or `undefined` when the prefetch failed. */
	readonly initialProduct?: Envelope<Product> | undefined;
}

/** The edit form for a loaded product — keyed by its version so a reload re-seeds the form. */
function EditProductForm({ product }: { readonly product: Product }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const invalidateProduct = useInvalidateProduct();
	const updateProduct = api.product.update.useMutation({
		onSuccess: async (response) => {
			await invalidateProduct(response.data.id);
			toastMessage.success({ title: "Product saved", description: response.data.name });
			router.push(ROUTES.catalog.products.detail(response.data.id));
		},
		onError: (error) => {
			toastMutationError("Could not save the product", error, UPDATE_PRODUCT_ERROR_MESSAGES);
		},
	});

	const handleSubmit = React.useCallback(
		(input: CreateProductInput): void => {
			// The version the form was loaded at: the API rejects the write if the product changed since.
			updateProduct.mutate({ ...input, id: product.id, version: product.version });
		},
		[product.id, product.version, updateProduct],
	);

	return (
		<ProductForm
			initialValues={toProductFormValues(product)}
			submitLabel="Save changes"
			isPending={updateProduct.isPending}
			onSubmit={handleSubmit}
			cancelHref={ROUTES.catalog.products.detail(product.id)}
		/>
	);
}

/** `/catalog/products/[id]/edit` — `PATCH /product/:id` with the loaded `version`, then the product's page. */
export function EditProductView({ id, initialProduct }: EditProductViewProps): React.JSX.Element {
	const { api } = useAuth();
	const detailQuery = api.product.detail.useQuery({ id }, initialDataOption(initialProduct));
	const product = detailQuery.data?.data;

	if (product === undefined) {
		return detailQuery.isError ? (
			<p role="alert" className="text-destructive">
				Could not load this product.
			</p>
		) : (
			<p className="text-muted-foreground">Loading product…</p>
		);
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-semibold">Edit {product.name}</h1>
			<EditProductForm key={`${product.id}:${String(product.version)}`} product={product} />
		</div>
	);
}
