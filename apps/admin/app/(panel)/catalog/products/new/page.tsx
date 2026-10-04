import { CreateProductView } from "../product-editor";

/** `/catalog/products/new` — create a product (gated by CREATE PRODUCT in the route rules). */
export default function CreateProductPage(): React.JSX.Element {
	return <CreateProductView />;
}
