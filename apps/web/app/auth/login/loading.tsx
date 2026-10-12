import { AuthFormSkeleton } from "@/components/loading/auth-form-skeleton";
import { SIGN_IN_LOADING_LABELS } from "@/components/loading/loading-labels";
import * as React from "react";

import { WebLoginAuthLayout } from "./login-auth-layout";

/** The sign-in form's fields: email and password. */
const SIGN_IN_FIELD_COUNT = 2;

/** `/auth/login` while the server decides which demo logins to offer — the real chrome around a form-shaped skeleton. */
export default function WebLoginLoading(): React.JSX.Element {
	return (
		<WebLoginAuthLayout>
			<AuthFormSkeleton fields={SIGN_IN_FIELD_COUNT} labels={SIGN_IN_LOADING_LABELS} />
		</WebLoginAuthLayout>
	);
}
