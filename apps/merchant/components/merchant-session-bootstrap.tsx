"use client";

import { AuthSessionBootstrap } from "@workspace/client/lib/auth/auth-session-bootstrap";
import * as React from "react";

/** Keeps merchant auth state aligned with the httpOnly cookie session. */
export function MerchantSessionBootstrap(): React.JSX.Element {
	return <AuthSessionBootstrap />;
}
