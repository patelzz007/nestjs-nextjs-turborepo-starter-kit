import { EmailTemplatesPageSkeleton } from "@/components/loading/email-skeletons";

/**
 * `/emails` redirects to the template browser, so it waits in that page's shape.
 */
export default function EmailsLoading(): React.JSX.Element {
	return <EmailTemplatesPageSkeleton />;
}
