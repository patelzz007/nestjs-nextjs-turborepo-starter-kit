import ProductDetailView from "../product-detail-view";

interface ProductDetailPageProps {
	readonly params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps): Promise<React.JSX.Element> {
	const { id } = await params;
	return <ProductDetailView id={id} />;
}
