import { createAdminServerCaller } from "@/lib/admin-server-api";

import ProductDetailView from "../product-detail-view.generated";

interface ProductDetailPageProps {
	readonly params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps): Promise<React.JSX.Element> {
	const { id } = await params;
	const server = createAdminServerCaller();
	const result = await Promise.allSettled([server.product.detail.query({ id })]);

	const first = result[0];
	const initialProduct = first.status === "fulfilled" ? first.value.data : undefined;

	return <ProductDetailView id={id} initialProduct={initialProduct} />;
}
