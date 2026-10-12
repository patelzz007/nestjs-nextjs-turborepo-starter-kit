import { EmailTemplatesPageSkeleton } from "@/components/loading/email-skeletons";

/**
 * `/emails/templates` while the template list and preview are fetched — mirrors `EmailPreviewView`.
 */
export default function EmailTemplatesLoading(): React.JSX.Element {
	return <EmailTemplatesPageSkeleton />;
}
