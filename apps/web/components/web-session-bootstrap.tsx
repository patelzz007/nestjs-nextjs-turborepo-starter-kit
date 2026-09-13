"use client";

import { AuthSessionBootstrap } from "@workspace/client/lib/auth/auth-session-bootstrap";
import * as React from "react";

/**
 * Reconciles persisted client auth state with the real httpOnly cookie session.
 */
export function WebSessionBootstrap(): React.JSX.Element {
	return <AuthSessionBootstrap />;
}
