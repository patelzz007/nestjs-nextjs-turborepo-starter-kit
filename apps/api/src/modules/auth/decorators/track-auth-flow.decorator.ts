import { z } from "zod";

import { AuthFlowEventSchema, CaughtValueSchema, JsonRecordSchema, JsonValueSchema, type CaughtValue } from "@workspace/shared";

import { AuthEventsService } from "../services/auth-events.service";

/**
 * Extracts the userId from the method's arguments or return value.
 * Return `null` for anonymous flows (e.g., forgot-password where user may not exist).
 */
type UserIdExtractor = (...args: readonly AuthFlowMethodArg[]) => string | null | undefined;

/** Any runtime value a decorated method can receive as an argument. */
export type AuthFlowMethodArg = object | string | number | boolean | bigint | symbol | null | undefined;

/** Host instance of a decorated method; `authEvents` is injected by Nest. */
interface AuthFlowHost {
	readonly authEvents?: AuthEventsService;
}

type AuthFlowMethod<TArgs extends AuthFlowMethodArg[], TResult extends AuthFlowMethodArg> = (this: AuthFlowHost, ...args: TArgs) => Promise<TResult>;

type AuthFlowMethodDecorator = <TArgs extends AuthFlowMethodArg[], TResult extends AuthFlowMethodArg>(
	target: object,
	propertyKey: string | symbol,
	descriptor: TypedPropertyDescriptor<AuthFlowMethod<TArgs, TResult>>,
) => TypedPropertyDescriptor<AuthFlowMethod<TArgs, TResult>>;

interface TrackAuthFlowOptions {
	/** The auth flow name (e.g., "signup", "login", "forgot-password"). */
	readonly flow: string;
	/**
	 * Optional: extract the client type from the method arguments.
	 * Defaults to `null` (not a client-type-specific flow).
	 */
	readonly clientType?: UserIdExtractor;
	/**
	 * Optional: extract the userId from the method arguments.
	 * If not provided, the decorator tries `result.id` or `result.userId` on success.
	 */
	readonly userId?: UserIdExtractor;
}

const AuthResultIdSchema = z.object({ id: z.string() }).strict();
const AuthResultUserIdSchema = z.object({ userId: z.string() }).strict();
const AuthResultNestedUserSchema = z.object({ user: z.object({ id: z.string() }).strict() }).strict();
const AuthErrorCodeSchema = z.object({ error: z.string() }).strict();
const AuthErrorMessageSchema = z.object({ message: z.string() }).strict();
const AuthErrorUserIdSchema = z.object({ userId: z.string() }).strict();

/**
 * Declarative decorator that wraps a method and automatically emits an
 * `AuthFlowEvent` on both success and failure, with accurate timing.
 *
 * Replaces the manual `flowStartedAt` + `emitFlow()` boilerplate that was
 * repeated in every auth method.
 *
 * @example
 *   @TrackAuthFlow({ flow: "signup" })
 *   public async signup(dto: SignupInput): Promise<SignupResponse> {
 *       // ... no emitFlow calls needed
 *   }
 *
 * @example
 *   @TrackAuthFlow({
 *       flow: "login",
 *       clientType: (_dto, clientType) => clientType ?? null,
 *   })
 *   public async login(dto: LoginInput, clientType?: string): Promise<LoginServiceResponse> {
 *       // ...
 *   }
 */
export function TrackAuthFlow(options: TrackAuthFlowOptions): AuthFlowMethodDecorator {
	const { flow, clientType: clientTypeExtractor, userId: userIdExtractor } = options;

	return function <TArgs extends AuthFlowMethodArg[], TResult extends AuthFlowMethodArg>(
		_target: object,
		propertyKey: string | symbol,
		descriptor: TypedPropertyDescriptor<AuthFlowMethod<TArgs, TResult>>,
	): TypedPropertyDescriptor<AuthFlowMethod<TArgs, TResult>> {
		const originalMethod = descriptor.value;
		if (originalMethod === undefined) {
			throw new TypeError(`TrackAuthFlow can only decorate async methods (${String(propertyKey)})`);
		}

		descriptor.value = async function (this: AuthFlowHost, ...args: TArgs): Promise<TResult> {
			const flowStartedAt: number = performance.now();
			const getAuthEvents = (): AuthEventsService | undefined => this.authEvents;

			const emitEvent = (status: "succeeded" | "failed", error: string | null, userId: string | null): void => {
				const authEvents = getAuthEvents();
				if (authEvents === undefined) {
					return;
				}

				const resolvedClientType = clientTypeExtractor !== undefined ? (clientTypeExtractor(...args) ?? null) : null;

				authEvents.emitFlow(
					AuthFlowEventSchema.parse({
						flow,
						userId,
						clientType: resolvedClientType,
						status,
						error,
						durationMs: Math.round(performance.now() - flowStartedAt),
					}),
				);
			};

			try {
				const result: TResult = await originalMethod.apply(this, args);

				let userId: string | null = null;
				if (userIdExtractor !== undefined) {
					userId = userIdExtractor(...args) ?? null;
				} else {
					userId = extractUserIdFromResult(result);
				}

				emitEvent("succeeded", null, userId);
				return result;
			} catch (caught) {
				const errorValue = CaughtValueSchema.safeParse(caught);
				const errorCode = errorValue.success ? extractErrorCode(errorValue.data) : "UNKNOWN_ERROR";
				let userId: string | null = null;
				if (userIdExtractor !== undefined) {
					userId = userIdExtractor(...args) ?? null;
				} else if (errorValue.success) {
					userId = extractUserIdFromCaught(errorValue.data);
				}

				emitEvent("failed", errorCode, userId);
				throw caught;
			}
		};

		return descriptor;
	};
}

function extractUserIdFromResult(result: AuthFlowMethodArg): string | null {
	const jsonValue = JsonValueSchema.safeParse(result);
	if (!jsonValue.success) {
		return null;
	}
	const value = jsonValue.data;
	const withId = AuthResultIdSchema.safeParse(value);
	if (withId.success) {
		return withId.data.id;
	}
	const withUserId = AuthResultUserIdSchema.safeParse(value);
	if (withUserId.success) {
		return withUserId.data.userId;
	}
	const withNestedUser = AuthResultNestedUserSchema.safeParse(value);
	if (withNestedUser.success) {
		return withNestedUser.data.user.id;
	}
	return null;
}

function extractUserIdFromCaught(value: CaughtValue): string | null {
	const record = JsonRecordSchema.safeParse(value);
	if (!record.success) {
		return null;
	}
	const withUserId = AuthErrorUserIdSchema.safeParse(record.data);
	return withUserId.success ? withUserId.data.userId : null;
}

function extractErrorCode(value: CaughtValue): string {
	if (value instanceof Error) {
		return value.message;
	}
	const record = JsonRecordSchema.safeParse(value);
	if (!record.success) {
		return "UNKNOWN_ERROR";
	}
	const withCode = AuthErrorCodeSchema.safeParse(record.data);
	if (withCode.success) {
		return withCode.data.error;
	}
	const withMessage = AuthErrorMessageSchema.safeParse(record.data);
	if (withMessage.success) {
		return withMessage.data.message;
	}
	return "UNKNOWN_ERROR";
}
