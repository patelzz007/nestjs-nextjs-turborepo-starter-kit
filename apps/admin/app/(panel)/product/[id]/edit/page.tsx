import { Can } from "@workspace/client/lib/auth/can";
import { PERMISSION } from "@workspace/shared";

import { AdminAccessDenied } from "@/components/access/admin-access-denied";

interface EditProductPageProps {
	readonly params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps): Promise<React.JSX.Element> {
	const { id } = await params;
	// PATCH /:id requires UPDATE; the route prefix rule only covers LIST.
	return (
		<Can permission={PERMISSION.PRODUCT.UPDATE} fallback={<AdminAccessDenied />}>
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold">Edit Product</h1>
				<p className="text-muted-foreground">Editing resource {id}</p>
			</div>
		</Can>
	);
}
