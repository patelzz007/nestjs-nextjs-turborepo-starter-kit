// ============================================
// common/api-docs.ts - Swagger / docs wiring
// ============================================
// Swagger lives here so `main.ts` doesn't hand-roll a path. The docs URL is
// DERIVED from the shared version constant (`apiDocsPath()` → `/v1/docs`), so
// a version bump touches exactly one place.
//
// Exposure policy (docs/technical/api/routes.md → "API docs (Swagger)") is resolved from
// the validated config (`resolveApiDocsPolicy` in config/api-config.schema.ts):
// ON in every environment unless `SWAGGER_ENABLED=0`, and always public. The
// document describes the contract only; every endpoint enforces its own
// authentication and authorization, so the docs need no gate.

import type { INestApplication } from "@nestjs/common";
import { METHOD_METADATA } from "@nestjs/common/constants.js";
import { MetadataScanner, ModulesContainer, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject, type OperationObject, type PathItemObject } from "@nestjs/swagger";
import { apiDocsPath, type AuthClientType } from "@workspace/shared";
import { cleanupOpenApiDoc } from "nestjs-zod";
import { z } from "zod";

import { IS_PUBLIC_KEY } from "../modules/auth/decorators/public.decorator";
import { zodStandardSchemaConverter } from "./openapi/zod-openapi-schema";

/** Name of the bearer security scheme (`DocumentBuilder.addBearerAuth()` default). */
export const BEARER_SECURITY_SCHEME = "bearer";

/** Name of the security scheme that selects which session cookie authenticates a request. */
export const CLIENT_TYPE_SECURITY_SCHEME = "clientType";

/** The header `AuthGuard` picks the session cookie by (`accessToken` / `adminAccessToken` / `merchantAccessToken`); `mobile` has no cookie. */
export const CLIENT_TYPE_HEADER = "X-Client-Type";

/**
 * The session Swagger UI uses when "Authorize" holds no `X-Client-Type`: the
 * admin panel's — the docs' audience is platform operators.
 */
export const SWAGGER_DEFAULT_CLIENT_TYPE: AuthClientType = "admin";

/** One outgoing Swagger UI request — the only field the interceptor touches. */
export interface SwaggerUiRequest {
	headers: Record<string, string | undefined>;
}

/**
 * Swagger UI `requestInterceptor`: sends `X-Client-Type: admin` unless the
 * user chose another value under "Authorize", so "Try it out" is
 * authenticated by the browser's admin session cookie with no token to paste.
 *
 * It runs IN THE BROWSER — `@nestjs/swagger` serializes it with `toString()` —
 * so it must not reference anything outside its own body; the literals below
 * mirror `CLIENT_TYPE_HEADER` / `SWAGGER_DEFAULT_CLIENT_TYPE`, and
 * `api-docs.spec.ts` holds them equal.
 */
export function swaggerClientTypeInterceptor(request: SwaggerUiRequest): SwaggerUiRequest {
	const header = "X-Client-Type";
	const fallback = "admin";
	const chosen: string | undefined = request.headers[header];
	if (chosen === undefined || chosen.trim().length === 0) {
		request.headers[header] = fallback;
	}
	return request;
}

/** The HTTP methods an OpenAPI path item can hold an operation under. */
const OPERATION_METHODS: readonly (keyof Pick<PathItemObject, "get" | "put" | "post" | "delete" | "patch" | "options" | "head" | "trace">)[] = [
	"get",
	"put",
	"post",
	"delete",
	"patch",
	"options",
	"head",
	"trace",
];

/** What Nest metadata is read from — a route handler. */
type RouteHandler = Parameters<Reflector["get"]>[1];
const CallableSchema = z.function();
const RouteHandlerSchema = z.custom<RouteHandler>((value) => CallableSchema.safeParse(value).success, "route handler function");

/**
 * Build the OpenAPI document for `app` — the ONE builder used by bootstrap
 * (served at `/v1/docs-json`) and by `test/openapi-document.e2e-spec.ts`, so
 * what the regression test asserts is exactly what developers see.
 *
 *   1. `SwaggerModule.createDocument` scans every controller. Request bodies,
 *      query and path parameters come from the zod schema each Zod request
 *      decorator (`ZodBody` / `ZodQuery` / `ZodParams` / `ZodParam`) attaches
 *      to its parameter, converted by `zodStandardSchemaConverter`; response
 *      shapes come from the `createZodDto` response DTOs.
 *   2. `cleanupOpenApiDoc` (nestjs-zod) post-processes the `createZodDto`
 *      schemas: strips its internal `x-nestjs_zod-*` markers, lifts nested
 *      definitions into `components`, and applies OpenAPI 3.0 `nullable`.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
	const config = new DocumentBuilder()
		.setTitle("Freebuff API")
		.setDescription("REST API for the Freebuff admin platform")
		.setVersion("1.0")
		.addBearerAuth()
		.addApiKey(
			{
				type: "apiKey",
				in: "header",
				name: CLIENT_TYPE_HEADER,
				description: `Which login session cookie authenticates the request: \`admin\` (admin panel — Swagger's default), \`web\` or \`merchant\`. Log in through that app (or POST /auth/login here) and the browser sends its httpOnly cookie automatically. A Bearer token, when set, takes priority. \`mobile\` (the mobile app) uses no cookie: it authenticates by Bearer token only, receives its tokens in response bodies, and must send \`X-App-Version\` (426 APP_VERSION_UNSUPPORTED below MOBILE_MIN_SUPPORTED_VERSION).`,
			},
			CLIENT_TYPE_SECURITY_SCHEME,
		)
		.build();
	const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config, { standardSchemaConverter: zodStandardSchemaConverter }));
	applyOperationSecurity(document, collectPublicOperationIds(app));
	return document;
}

/**
 * The operationIds of every `@Public()` route — exactly what the global
 * `AuthGuard` skips (handler metadata, then the controller's). Nest Swagger's
 * default operationId is `<Controller>_<method>`.
 */
export function collectPublicOperationIds(app: INestApplication): ReadonlySet<string> {
	const reflector: Reflector = app.get(Reflector);
	const scanner = new MetadataScanner();
	const publicIds = new Set<string>();
	for (const module of app.get(ModulesContainer).values()) {
		for (const wrapper of module.controllers.values()) {
			const instance: object = wrapper.instance;
			const prototype: object | null = Reflect.getPrototypeOf(instance);
			if (prototype === null) continue;
			for (const methodName of scanner.getAllMethodNames(prototype)) {
				const handler: RouteHandler = RouteHandlerSchema.parse(Object.getOwnPropertyDescriptor(prototype, methodName)?.value);
				if (reflector.get(METHOD_METADATA, handler) === undefined) continue;
				if (reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [handler, instance.constructor]) === true) {
					publicIds.add(`${instance.constructor.name}_${methodName}`);
				}
			}
		}
	}
	return publicIds;
}

/**
 * Give EVERY operation an explicit security requirement, derived from the
 * same `@Public()` metadata `AuthGuard` enforces. Swagger UI only sends the
 * credentials entered under "Authorize" to operations that declare them.
 *
 * - protected: the bearer token OR the session cookie selected by `X-Client-Type`;
 * - `@Public()`: nothing required (`{}`), but `X-Client-Type` still sent, so a
 *   login from Swagger sets the cookie of the selected session.
 */
export function applyOperationSecurity(document: OpenAPIObject, publicOperationIds: ReadonlySet<string>): void {
	for (const pathItem of Object.values(document.paths)) {
		for (const method of OPERATION_METHODS) {
			const operation: OperationObject | undefined = pathItem[method];
			if (operation === undefined) continue;
			const isPublic: boolean = operation.operationId !== undefined && publicOperationIds.has(operation.operationId);
			operation.security = isPublic ? [{}, { [CLIENT_TYPE_SECURITY_SCHEME]: [] }] : [{ [BEARER_SECURITY_SCHEME]: [] }, { [CLIENT_TYPE_SECURITY_SCHEME]: [] }];
		}
	}
}

/** Mount Swagger at the version-derived docs path (`apiDocsPath()` → `/v1/docs`). */
export function setupApiDocs(app: INestApplication, document: OpenAPIObject): void {
	SwaggerModule.setup(apiDocsPath().replace(/^\//, ""), app, document, {
		customSiteTitle: "Freebuff API",
		swaggerOptions: {
			withCredentials: true,
			// Keep what was entered under "Authorize" across page reloads.
			persistAuthorization: true,
			// Default `X-Client-Type: admin`, so the admin session cookie authenticates "Try it out".
			requestInterceptor: swaggerClientTypeInterceptor,
		},
	});
}
