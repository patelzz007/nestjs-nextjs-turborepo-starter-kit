"use client";

import { useQueryClient } from "@tanstack/react-query";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/auth";
import { ApiErrorCodes, type CreateSampleCategoryInput, type Envelope, type SampleCategory } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import { useRouter } from "next/navigation";
import * as React from "react";

import { CategoryForm } from "@/components/catalog/category-form";
import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";
import { EMPTY_CATEGORY_FORM_VALUES, toCategoryFormValues } from "@/lib/catalog/form-values";
import { ROUTES } from "@/lib/routes";

/** `PATCH /sample-category/:id` answers CONFLICT when the category changed since it was loaded (optimistic lock). */
const UPDATE_CATEGORY_ERROR_MESSAGES: MutationErrorMessages = {
	[ApiErrorCodes.CONFLICT]: "Someone else changed this category while you were editing. Reload the page to edit the latest version.",
};

/** Refreshes every category list (and the product lists, which show category names) and this category's detail after a write. */
function useInvalidateCategory(): (categoryId: string) => Promise<void> {
	const queryClient = useQueryClient();
	return React.useCallback(
		async (categoryId: string): Promise<void> => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: apiRouter.sampleCategory.list.scopeKey(undefined) }),
				queryClient.invalidateQueries({ queryKey: apiRouter.sampleCategory.detail.scopeKey({ id: categoryId }) }),
				queryClient.invalidateQueries({ queryKey: apiRouter.product.list.scopeKey(undefined) }),
			]);
		},
		[queryClient],
	);
}

/** `/catalog/categories/new` — `POST /sample-category`, then the new category's page. */
export function CreateCategoryView(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const invalidateCategory = useInvalidateCategory();
	const createCategory = api.sampleCategory.create.useMutation({
		onSuccess: async (response) => {
			await invalidateCategory(response.data.id);
			toastMessage.success({ title: "Category created", description: response.data.name });
			router.push(ROUTES.catalog.categories.detail(response.data.id));
		},
		onError: (error) => {
			toastMutationError("Could not create the category", error);
		},
	});

	const handleSubmit = React.useCallback(
		(input: CreateSampleCategoryInput): void => {
			createCategory.mutate(input);
		},
		[createCategory],
	);

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-semibold">New category</h1>
			<CategoryForm
				initialValues={EMPTY_CATEGORY_FORM_VALUES}
				submitLabel="Create category"
				isPending={createCategory.isPending}
				onSubmit={handleSubmit}
				cancelHref={ROUTES.catalog.categories.list}
			/>
		</div>
	);
}

export interface EditCategoryViewProps {
	readonly id: string;
	/** The server-prefetched `GET /sample-category/:id` envelope, or `undefined` when the prefetch failed. */
	readonly initialCategory?: Envelope<SampleCategory> | undefined;
}

function EditCategoryForm({ category }: { readonly category: SampleCategory }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const invalidateCategory = useInvalidateCategory();
	const updateCategory = api.sampleCategory.update.useMutation({
		onSuccess: async (response) => {
			await invalidateCategory(response.data.id);
			toastMessage.success({ title: "Category saved", description: response.data.name });
			router.push(ROUTES.catalog.categories.detail(response.data.id));
		},
		onError: (error) => {
			toastMutationError("Could not save the category", error, UPDATE_CATEGORY_ERROR_MESSAGES);
		},
	});

	const handleSubmit = React.useCallback(
		(input: CreateSampleCategoryInput): void => {
			// The version the form was loaded at: the API rejects the write if the category changed since.
			updateCategory.mutate({ ...input, id: category.id, version: category.version });
		},
		[category.id, category.version, updateCategory],
	);

	return (
		<CategoryForm
			initialValues={toCategoryFormValues(category)}
			submitLabel="Save changes"
			isPending={updateCategory.isPending}
			onSubmit={handleSubmit}
			cancelHref={ROUTES.catalog.categories.detail(category.id)}
		/>
	);
}

/** `/catalog/categories/[id]/edit` — `PATCH /sample-category/:id`, then the category's page. */
export function EditCategoryView({ id, initialCategory }: EditCategoryViewProps): React.JSX.Element {
	const { api } = useAuth();
	const detailQuery = api.sampleCategory.detail.useQuery({ id }, initialDataOption(initialCategory));
	const category = detailQuery.data?.data;

	if (category === undefined) {
		return detailQuery.isError ? (
			<p role="alert" className="text-destructive">
				Could not load this category.
			</p>
		) : (
			<p className="text-muted-foreground">Loading category…</p>
		);
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-semibold">Edit {category.name}</h1>
			<EditCategoryForm key={`${category.id}:${String(category.version)}`} category={category} />
		</div>
	);
}
