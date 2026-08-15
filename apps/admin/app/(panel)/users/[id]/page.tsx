import UserDetailView from "./user-detail";

/**
 * `/users/[id]` — user drill-down. Server component: owns the dynamic route
 * param and hands `userId` to the client `UserDetailView` as a prop (no
 * `useParams` in the view). The view is a breadcrumb demo with deterministic
 * mock data; a real app would fetch the user through `useApi` here instead.
 */
export default async function UserDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const { id } = await params;

	return <UserDetailView userId={id} />;
}
