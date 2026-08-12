// ============================================
// lib/endpoints.ts - Typed API endpoint registry
// ============================================
"use client";

import type { QueryKey } from "@tanstack/react-query";
import {
	ApiResponseMetaSchema,
	EmailLogListResponseSchema,
	EmailPreviewListResponseSchema,
	EmailPreviewSchema,
	EmailSendResultSchema,
	LoginResponseSchema,
	LoginSchema,
	LogoutResponseSchema,
	RefreshResponseSchema,
	SessionStatusSchema,
	SignupResponseSchema,
	SignupSchema,
	UserResponseSchema,
	type ApiResponseMeta,
	type EmailLogListResponse,
	type EmailPreview,
	type EmailPreviewListResponse,
	type EmailSendResult,
	type LoginInput,
	type LoginResponse,
	type LogoutResponse,
	type RefreshResponse,
	type SessionStatus,
	type SignupInput,
	type SignupResponse,
	type UserResponse,
} from "@workspace/shared";
import { z, type ZodType } from "zod";

// ── Response envelope ──────────────────────────────────────────────────────
// Every endpoint returns the ResponseInterceptor envelope:
// { success: true, data, meta }. We build a typed envelope schema per endpoint
// so the FE knows the exact shape without `any` or `z.unknown`.

interface Envelope<Data> {
	readonly success: true;
	readonly data: Data;
	readonly meta: ApiResponseMeta;
}

// The `Input` type parameter defaults to `unknown` in Zod 4, which keeps the
// input widened so paginated meta schemas (whose input carries extra required
// fields) remain assignable under Zod 4's contravariant `Input` type parameter.
function envelope<Data>(dataSchema: ZodType<Data>, metaSchema: ZodType<ApiResponseMeta> = ApiResponseMetaSchema): ZodType<Envelope<Data>> {
	return z
		.object({
			success: z.literal(true),
			data: dataSchema,
			meta: metaSchema,
		})
		.strict();
}

// ── Procedure config types ─────────────────────────────────────────────────

interface GetProcedure<Resp> {
	readonly path: string;
	readonly method: "GET";
	readonly queryKey: QueryKey;
	readonly responseSchema: ZodType<Resp>;
}

interface PostProcedure<Body, Resp> {
	readonly path: string;
	readonly method: "POST";
	readonly queryKey: QueryKey;
	readonly bodySchema: ZodType<Body>;
	readonly responseSchema: ZodType<Resp>;
	readonly baseOptions?: { readonly headers?: Record<string, string> };
}

// ── Auth endpoints ─────────────────────────────────────────────────────────

export const authEndpoints: {
	readonly me: GetProcedure<Envelope<UserResponse>>;
	readonly sessionStatus: GetProcedure<Envelope<SessionStatus>>;
	readonly login: PostProcedure<LoginInput, Envelope<LoginResponse>>;
	readonly adminLogin: PostProcedure<LoginInput, Envelope<LoginResponse>>;
	readonly signup: PostProcedure<SignupInput, Envelope<SignupResponse>>;
	readonly refresh: PostProcedure<Record<string, never>, Envelope<RefreshResponse>>;
	readonly logout: PostProcedure<Record<string, never>, Envelope<LogoutResponse>>;
} = {
	me: {
		path: "/auth/me",
		method: "GET",
		queryKey: ["auth", "me"],
		responseSchema: envelope(UserResponseSchema),
	},
	// Very basic protected endpoint — proves the access token is valid and
	// answers "who am I + when does my token expire" with no DB work. The
	// admin panel polls it on page mount so every SPA navigation exercises
	// the 401 → silent-refresh → retry flow (see docs/token-refresh.md).
	sessionStatus: {
		path: "/session",
		method: "GET",
		queryKey: ["auth", "session-status"],
		responseSchema: envelope(SessionStatusSchema),
	},
	login: {
		path: "/auth/login",
		method: "POST",
		queryKey: ["auth", "login"],
		bodySchema: LoginSchema,
		responseSchema: envelope(LoginResponseSchema),
	},
	adminLogin: {
		path: "/auth/login",
		method: "POST",
		queryKey: ["auth", "admin-login"],
		bodySchema: LoginSchema,
		responseSchema: envelope(LoginResponseSchema),
		baseOptions: { headers: { "X-Client-Type": "admin" } },
	},
	signup: {
		path: "/auth/signup",
		method: "POST",
		queryKey: ["auth", "signup"],
		bodySchema: SignupSchema,
		responseSchema: envelope(SignupResponseSchema),
	},
	refresh: {
		path: "/auth/refresh",
		method: "POST",
		queryKey: ["auth", "refresh"],
		bodySchema: z.object({}).strict(),
		responseSchema: envelope(RefreshResponseSchema),
	},
	logout: {
		path: "/auth/logout",
		method: "POST",
		queryKey: ["auth", "logout"],
		bodySchema: z.object({}).strict(),
		responseSchema: envelope(LogoutResponseSchema),
	},
};

// ── Email template preview endpoints ───────────────────────────────────────

/**
 * Email-template preview endpoints used by the admin panel's Email Templates
 * page. `previewDetail` is a factory because the route carries a `:key` param
 * — the admin page builds the procedure per selected template.
 */
export const emailEndpoints: {
	readonly previewList: GetProcedure<Envelope<EmailPreviewListResponse>>;
	readonly previewDetail: (key: string) => GetProcedure<Envelope<EmailPreview>>;
	readonly previewSend: (key: string) => PostProcedure<Record<string, never>, Envelope<EmailSendResult>>;
	readonly logList: GetProcedure<Envelope<EmailLogListResponse>>;
} = {
	previewList: {
		path: "/notifications/email-preview",
		method: "GET",
		queryKey: ["email", "preview-list"],
		responseSchema: envelope(EmailPreviewListResponseSchema),
	},
	previewDetail: (key: string): GetProcedure<Envelope<EmailPreview>> => ({
		path: `/notifications/email-preview/${key}`,
		method: "GET",
		queryKey: ["email", "preview-detail", key],
		responseSchema: envelope(EmailPreviewSchema),
	}),
	previewSend: (key: string): PostProcedure<Record<string, never>, Envelope<EmailSendResult>> => ({
		path: `/notifications/email-preview/${key}/send`,
		method: "POST",
		queryKey: ["email", "preview-send", key],
		bodySchema: z.object({}).strict(),
		responseSchema: envelope(EmailSendResultSchema),
	}),
	logList: {
		path: "/notifications/email-log",
		method: "GET",
		queryKey: ["email", "log-list"],
		responseSchema: envelope(EmailLogListResponseSchema),
	},
};
