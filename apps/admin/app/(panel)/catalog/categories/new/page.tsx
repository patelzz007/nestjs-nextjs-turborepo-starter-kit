import { CreateCategoryView } from "../category-editor";

/** `/catalog/categories/new` — create a category (gated by CREATE SAMPLE_CATEGORY in the route rules). */
export default function CreateCategoryPage(): React.JSX.Element {
	return <CreateCategoryView />;
}
