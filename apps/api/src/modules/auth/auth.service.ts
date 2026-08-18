import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
	epochMs,
	PaginationSchema,
	type AdminUserDetail,
	type AdminUserListQuery,
	type EpochMs,
	type ForgotPasswordInput,
	type ForgotPasswordResponse,
	type LoginInput,
	type LoginServiceResponse,
	type MessageResponse,
	type PaginationInput,
	type ResendVerificationInput,
	type ResendVerificationResponse,
	type ResetPasswordInput,
	type ResetPasswordResponse,
	type SignupInput,
	type SignupResponse,
	type UserResponse,
	type VerifyEmailResponse,
} from "@workspace/shared";

import { UserPermissions } from "../rbac/rbac.interface";
import { parseExpiryToMilliseconds } from "../../common/utils/expiry";
import { TypedConfigService } from "../../config/typed-config.service";
import { LogService } from "../../modules/logs/logs.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";

import { AuthEventsService, AuthFlowEventSchema } from "./services/auth-events.service";
import { CryptoService } from "./services/crypto.service";
import { EmailService } from "./services/email.service";
import { TokenService } from "./services/token.service";

/**
 * Credential / identity / admin operations: signup, login, email verification,
 * password reset, profile (`/me`), and SuperAdmin user management.
 *
 * Session lifecycle (refresh, logout, active sessions) lives in
 * `modules/sessions` and impersonation in `modules/impersonation` — see
 * `docs/architecture.md` (module layout convention).
 */
@Injectable()
export class AuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly tokenService: TokenService,
		private readonly cryptoService: CryptoService,
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
		private readonly rbacService: RbacService,
		private readonly emailService: EmailService,
		private readonly authEvents: AuthEventsService,
	) {}

	public async signup(signupDto: SignupInput): Promise<SignupResponse> {
		const { email, password, fullName } = signupDto;
		const flowStartedAt: number = performance.now();

		const existingUser = await this.prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			this.authEvents.emitFlow(
				AuthFlowEventSchema.parse({
					flow: "signup",
					userId: null,
					clientType: null,
					status: "failed",
					error: "EMAIL_IN_USE",
					durationMs: Math.round(performance.now() - flowStartedAt),
				}),
			);
			throw new ConflictException("Email already in use");
		}

		const hashedPassword = await this.cryptoService.hash(password);

		// Generate email verification token before creating the user
		const verificationToken = await this.tokenService.generateEmailVerificationToken(email);

		// ═══════════════════════════════════════════════════════════════════
		// Use a transaction so user creation and role assignment are atomic
		// ═══════════════════════════════════════════════════════════════════
		const { user: newUser, userPermissions } = await this.prisma.$transaction(async (tx) => {
			const created = await tx.user.create({
				data: { email, passwordHash: hashedPassword, fullName },
				select: {
					id: true,
					email: true,
					fullName: true,
					isActive: true,
					isSuperAdmin: true,
					createdAt: true,
					updatedAt: true,
					isDeleted: true,
					deletedAt: true,
				},
			});

			// Assign default user role
			const userRole = await tx.role.findUnique({ where: { name: "User" } });
			if (userRole) {
				await tx.userRole.create({
					data: { userId: created.id, roleId: userRole.id },
				});
			}

			// Fetch permissions inside the same transaction
			const permissions = await this.rbacService.getUserPermissions(created.id);

			return { user: created, userPermissions: permissions };
		});

		// Log without PII (email address)
		this.logService.info(`New user registered: ${newUser.email}`, {
			userId: newUser.id,
			context: "AuthService",
			metadata: {
				email: newUser.email,
				fullName: newUser.fullName,
				roles: userPermissions.roles.map((r: { name: string }) => r.name).join(","),
				isSuperAdmin: newUser.isSuperAdmin ? "true" : "false",
			},
		});

		this.authEvents.emitFlow(
			AuthFlowEventSchema.parse({
				flow: "signup",
				userId: newUser.id,
				clientType: null,
				status: "succeeded",
				error: null,
				durationMs: Math.round(performance.now() - flowStartedAt),
			}),
		);

		return {
			user: this.buildUserResponse(newUser, userPermissions, false),
			verificationToken,
			message: "User registered successfully",
		};
	}

	/**
	 * Authenticate a user with email and password.
	 *
	 * @param loginDto  - Validation-friendly login input (email + password)
	 * @param clientType - Origin of the login request ("web" | "admin").
	 *                     The admin panel sends `X-Client-Type: admin` header.
	 *                     Users with `isSuperAdmin: true` or the `ADMIN_DASHBOARD`
	 *                     resource permission may log in from the admin panel.
	 * @param deviceInfo - Device/user-agent string for session tracking
	 * @param ipAddress  - Client IP address for session tracking
	 */
	public async login(loginDto: LoginInput, clientType?: string, deviceInfo?: string, ipAddress?: string): Promise<LoginServiceResponse> {
		const { email, password } = loginDto;
		const flowStartedAt: number = performance.now();

		const user = await this.prisma.user.findUnique({
			where: { email },
			select: {
				id: true,
				email: true,
				fullName: true,
				passwordHash: true,
				isActive: true,
				isSuperAdmin: true,
				emailVerifiedAt: true,
				createdAt: true,
				updatedAt: true,
				isDeleted: true,
				deletedAt: true,
				failedLoginAttempts: true,
				lockedUntil: true,
			},
		});

		// ── Client-type check: admin-only login ─────────────────────────
		// The admin panel sends `X-Client-Type: admin` header.
		// Access is granted if:
		//   1. User is a SuperAdmin (fast path — no extra query), OR
		//   2. User has the ADMIN_DASHBOARD resource permission via their role(s)
		// Users whose email doesn't exist get a consistent 403 (no enumeration).
		// ────────────────────────────────────────────────────────────────
		if (clientType === "admin") {
			if (!user) {
				throw new ForbiddenException({
					message: "Admin access required. This account does not have administrator privileges.",
					error: "ADMIN_ACCESS_REQUIRED",
				});
			}

			// Fast path: SuperAdmin always has admin panel access
			if (!user.isSuperAdmin) {
				// Check ADMIN_DASHBOARD permission via RBAC
				const userPerms: UserPermissions = await this.rbacService.getUserPermissions(user.id);
				const hasDashboardAccess: boolean = userPerms.permissions.some((p) => p.resource === "ADMIN_DASHBOARD");

				if (!hasDashboardAccess) {
					throw new ForbiddenException({
						message: "Admin access required. This account does not have administrator privileges.",
						error: "ADMIN_ACCESS_REQUIRED",
					});
				}
			}
		}
		// ─────────────────────────────────────────────────────────────────

		// Use consistent dummy hash to prevent timing-based account enumeration
		const dummyHash = await this.cryptoService.hash("dummy-password-to-prevent-timing-attack");
		const passwordHash = user?.passwordHash ?? dummyHash;
		const passwordMatches = await this.cryptoService.compare(password, passwordHash);

		// ── Brute-force protection ────────────────────────────────────────
		// Check BEFORE the outer error block so TypeScript sees the clean
		// `{...} | null` type (not a narrowed union after `!user ||`).
		if (user?.lockedUntil && user.lockedUntil > Date.now()) {
			const remainingMs: number = Number(user.lockedUntil) - Date.now();
			const remainingSec: number = Math.max(1, Math.ceil(remainingMs / 1000));
			const remainingMin: number = Math.ceil(remainingSec / 60);
			this.authEvents.emitFlow(
				AuthFlowEventSchema.parse({
					flow: "login",
					userId: user.id,
					clientType: clientType ?? null,
					status: "failed",
					error: "ACCOUNT_LOCKED",
					durationMs: Math.round(performance.now() - flowStartedAt),
				}),
			);
			throw new UnauthorizedException({
				message: `Account temporarily locked. Try again in ${String(remainingMin)} minute(s).`,
				error: "ACCOUNT_LOCKED",
				// Structured lockout payload so the client can render a live
				// "retry in MM:SS" countdown instead of a static message.
				lockedUntil: epochMs(Number(user.lockedUntil)),
				remainingSeconds: remainingSec,
			});
		}
		// ─────────────────────────────────────────────────────────────────

		if (!user || !user.isActive || user.isDeleted || !passwordMatches) {
			// ── Increment failed attempt counter ───────────────────────
			if (user) {
				const MAX_FAILED_ATTEMPTS = 5;
				const LOCK_DURATION_MS: number = 15 * 60 * 1000; // 15 minutes
				const shouldLock: boolean = user.failedLoginAttempts + 1 >= MAX_FAILED_ATTEMPTS;
				const lockedUntil: EpochMs = epochMs(Date.now() + LOCK_DURATION_MS);

				await this.prisma.user.update({
					where: { id: user.id },
					data: {
						failedLoginAttempts: { increment: 1 },
						lockedUntil: shouldLock ? lockedUntil : undefined,
						updatedAt: Date.now(),
					},
				});

				// ── Send lockout alert email ────────────────────────────
				// If the account just crossed the threshold, notify the user.
				// Fire-and-forget — never throw from an email failure.
				if (shouldLock) {
					await this.emailService.sendAccountLockedEmail(user.email, lockedUntil);
				}
				// ──────────────────────────────────────────────────────────
			}
			// ────────────────────────────────────────────────────────────

			this.authEvents.emitFlow(
				AuthFlowEventSchema.parse({
					flow: "login",
					userId: user?.id ?? null,
					clientType: clientType ?? null,
					status: "failed",
					error: "INVALID_CREDENTIALS",
					durationMs: Math.round(performance.now() - flowStartedAt),
				}),
			);
			throw new UnauthorizedException({
				message: "Invalid email or password",
				error: "INVALID_CREDENTIALS",
			});
		}

		// ── Reset failed attempts on successful login ────────────────────
		if (user.failedLoginAttempts > 0 || user.lockedUntil) {
			await this.prisma.user.update({
				where: { id: user.id },
				data: {
					failedLoginAttempts: 0,
					lockedUntil: null,
					updatedAt: Date.now(),
				},
			});
		}

		// Get user permissions
		const userPermissions: UserPermissions = await this.rbacService.getUserPermissions(user.id);

		const isEmailVerified = user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now();
		const flatUser = this.buildUserResponse(user, userPermissions, isEmailVerified);

		// Create the refresh token record FIRST to get its ID (used as JWT jti)
		const expiryMs = parseExpiryToMilliseconds(this.config.jwtRefreshExpiry);
		const expiresAt: EpochMs = epochMs(Date.now() + expiryMs);

		const refreshTokenRecord = await this.prisma.refreshToken.create({
			data: {
				token: "", // placeholder — will be updated with hashed token after generation
				userId: user.id,
				deviceInfo: deviceInfo ?? "Unknown Device",
				ipAddress: ipAddress ?? "Unknown IP",
				expiresAt,
			},
		});

		// Generate tokens — the refresh token embeds the record ID as jti
		const tokens = await this.tokenService.generateTokens(flatUser, refreshTokenRecord.id);

		// Hash the refresh token and store it in the record
		const hashedRt = await this.cryptoService.hash(tokens.refreshToken);

		await this.prisma.refreshToken.update({
			where: { id: refreshTokenRecord.id },
			data: { token: hashedRt, updatedAt: Date.now() },
		});

		// Clean up expired tokens for this user
		await this.cleanupExpiredTokens(user.id);

		this.logService.info(`User logged in`, {
			userId: user.id,
			context: "AuthService",
			metadata: {
				email: user.email,
				fullName: user.fullName,
				roles: userPermissions.roles.map((r: { name: string }) => r.name).join(","),
				isSuperAdmin: user.isSuperAdmin,
				isEmailVerified: isEmailVerified,
				device: deviceInfo ?? "Unknown",
				ip: ipAddress ?? "Unknown",
			},
		});

		this.authEvents.emitFlow(
			AuthFlowEventSchema.parse({
				flow: "login",
				userId: user.id,
				clientType: clientType ?? null,
				status: "succeeded",
				error: null,
				durationMs: Math.round(performance.now() - flowStartedAt),
			}),
		);

		return {
			user: flatUser,
			...tokens,
		};
	}

	public async getMe(userId: string): Promise<UserResponse> {
		return this.getUserResponse(userId);
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// Email Verification
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Resend the email verification link.
	 * Always returns the same response to prevent email enumeration.
	 */
	public async resendVerificationEmail(dto: ResendVerificationInput): Promise<ResendVerificationResponse> {
		const { email } = dto;

		const user = await this.prisma.user.findUnique({
			where: { email },
			select: { id: true, email: true, isActive: true, emailVerifiedAt: true, isDeleted: true, deletedAt: true },
		});

		// Always return the same message to prevent email enumeration
		if (!user?.isActive || user.emailVerifiedAt) {
			return { message: "If an account with that email exists, a verification email has been sent." };
		}

		// Generate a new verification token
		const verificationToken = await this.tokenService.generateEmailVerificationToken(email);

		// Send email (fire-and-forget — never throw)
		await this.emailService.sendVerificationEmail(email, verificationToken);

		return { message: "If an account with that email exists, a verification email has been sent." };
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// Password Reset
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Initiate a password reset flow.
	 * Always returns the same response regardless of whether the email exists,
	 * to prevent email enumeration attacks.
	 */
	public async forgotPassword(dto: ForgotPasswordInput): Promise<ForgotPasswordResponse> {
		const { email } = dto;
		const flowStartedAt: number = performance.now();

		const user = await this.prisma.user.findUnique({
			where: { email },
			select: { id: true, email: true, isActive: true, isDeleted: true, deletedAt: true },
		});

		// Always return the same message regardless of whether the user exists
		// to prevent email enumeration attacks
		if (!user?.isActive || user.isDeleted) {
			this.authEvents.emitFlow(
				AuthFlowEventSchema.parse({
					flow: "forgot-password",
					userId: null,
					clientType: null,
					status: "succeeded",
					error: null,
					durationMs: Math.round(performance.now() - flowStartedAt),
				}),
			);
			return { message: "If an account with that email exists, a password reset link has been sent." };
		}

		// Invalidate any existing unused tokens for this user
		await this.prisma.passwordResetToken.updateMany({
			where: { userId: user.id, usedAt: null, expiresAt: { gte: Date.now() } },
			data: { expiresAt: Date.now(), updatedAt: Date.now() }, // Expire existing tokens immediately
		});

		// Generate a cryptographically random token
		const rawToken = this.cryptoService.generateRandomToken();
		const tokenHash = await this.cryptoService.hash(rawToken);

		await this.prisma.passwordResetToken.create({
			data: {
				userId: user.id,
				token: tokenHash,
				expiresAt: Date.now() + 3_600_000, // 1 hour
			},
		});

		// Send email (fire-and-forget — never throw)
		await this.emailService.sendPasswordResetEmail(email, rawToken);

		this.authEvents.emitFlow(
			AuthFlowEventSchema.parse({
				flow: "forgot-password",
				userId: user.id,
				clientType: null,
				status: "succeeded",
				error: null,
				durationMs: Math.round(performance.now() - flowStartedAt),
			}),
		);

		return { message: "If an account with that email exists, a password reset link has been sent." };
	}

	/**
	 * Reset a user's password using a valid reset token.
	 */
	public async resetPassword(dto: ResetPasswordInput): Promise<ResetPasswordResponse> {
		const { token: rawToken, password } = dto;
		const flowStartedAt: number = performance.now();

		// Find all valid (unused, not expired) reset tokens
		const candidates = await this.prisma.passwordResetToken.findMany({
			where: {
				usedAt: null,
				expiresAt: { gte: Date.now() },
			},
			select: { id: true, userId: true, token: true },
		});

		// Find the matching token by comparing hashes
		let matchedToken: (typeof candidates)[number] | undefined;
		for (const candidate of candidates) {
			const isValid = await this.cryptoService.compare(rawToken, candidate.token);
			if (isValid) {
				matchedToken = candidate;
				break;
			}
		}

		if (!matchedToken) {
			this.authEvents.emitFlow(
				AuthFlowEventSchema.parse({
					flow: "reset-password",
					userId: null,
					clientType: null,
					status: "failed",
					error: "INVALID_RESET_TOKEN",
					durationMs: Math.round(performance.now() - flowStartedAt),
				}),
			);
			throw new UnauthorizedException("Invalid or expired reset token");
		}

		// Hash the new password and update the user
		const newPasswordHash = await this.cryptoService.hash(password);

		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: matchedToken.userId },
				data: { passwordHash: newPasswordHash, updatedAt: Date.now() },
			}),
			// Mark the token as used (one-time use)
			this.prisma.passwordResetToken.update({
				where: { id: matchedToken.id },
				data: { usedAt: Date.now(), updatedAt: Date.now() },
			}),
		]);

		// Revoke all existing refresh tokens for this user (force re-login)
		await this.prisma.refreshToken.updateMany({
			where: { userId: matchedToken.userId },
			data: { isDeleted: true, deletedAt: Date.now(), updatedAt: Date.now() },
		});

		this.logService.info("Password reset completed", {
			userId: matchedToken.userId,
			context: "AuthService",
			metadata: {
				userId: matchedToken.userId,
			},
		});

		this.authEvents.emitFlow(
			AuthFlowEventSchema.parse({
				flow: "reset-password",
				userId: matchedToken.userId,
				clientType: null,
				status: "succeeded",
				error: null,
				durationMs: Math.round(performance.now() - flowStartedAt),
			}),
		);

		return { message: "Password has been reset successfully. Please log in with your new password." };
	}

	/**
	 * Verify a user's email address using a verification token.
	 */
	public async verifyEmail(token: string): Promise<VerifyEmailResponse> {
		const email = await this.tokenService.verifyEmailToken(token);
		const flowStartedAt: number = performance.now();

		// Mark the user's email as verified
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (!user) {
			throw new NotFoundException("User not found");
		}

		if (user.emailVerifiedAt) {
			this.authEvents.emitFlow(
				AuthFlowEventSchema.parse({
					flow: "verify-email",
					userId: user.id,
					clientType: null,
					status: "succeeded",
					error: null,
					durationMs: Math.round(performance.now() - flowStartedAt),
				}),
			);
			return { message: "Email already verified" };
		}

		await this.prisma.user.update({
			where: { email },
			data: { emailVerifiedAt: Date.now(), updatedAt: Date.now() },
		});

		this.authEvents.emitFlow(
			AuthFlowEventSchema.parse({
				flow: "verify-email",
				userId: user.id,
				clientType: null,
				status: "succeeded",
				error: null,
				durationMs: Math.round(performance.now() - flowStartedAt),
			}),
		);

		return { message: "Email verified successfully" };
	}

	/**
	 * Paginated admin user list with lockout status and roles.
	 */
	public async getAdminUsersList(query: AdminUserListQuery): Promise<{
		readonly items: AdminUserDetail[];
		readonly total: number;
		readonly page: number;
		readonly limit: number;
		readonly totalPages: number;
		readonly hasNext: boolean;
		readonly hasPrevious: boolean;
	}> {
		const pagination: PaginationInput = PaginationSchema.parse(query);
		const page: number = pagination.page;
		const limit: number = pagination.limit;
		const skip: number = (page - 1) * limit;

		const [users, total] = await Promise.all([
			this.prisma.user.findMany({
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				select: {
					id: true,
					email: true,
					fullName: true,
					isActive: true,
					isSuperAdmin: true,
					emailVerifiedAt: true,
					createdAt: true,
					updatedAt: true,
					isDeleted: true,
					deletedAt: true,
					failedLoginAttempts: true,
					lockedUntil: true,
				},
			}),
			this.prisma.user.count(),
		]);

		const userIds: string[] = users.map((u) => u.id);
		const userRoles = await this.prisma.userRole.findMany({
			where: { userId: { in: userIds }, isDeleted: false, role: { isDeleted: false } },
			include: {
				role: { select: { id: true, name: true, description: true } },
			},
		});

		// Group roles by userId
		const rolesByUserId = new Map<string, { id: string; name: string; description: string | null }[]>();
		for (const ur of userRoles) {
			const existing = rolesByUserId.get(ur.userId) ?? [];
			existing.push({
				id: ur.role.id,
				name: ur.role.name,
				description: ur.role.description,
			});
			rolesByUserId.set(ur.userId, existing);
		}

		const items: AdminUserDetail[] = users.map((u) => {
			const isEmailVerified: boolean = u.emailVerifiedAt !== null && u.emailVerifiedAt <= Date.now();
			const roles = rolesByUserId.get(u.id) ?? [];
			const hasAdminAccess: boolean = u.isSuperAdmin || roles.some((r) => r.name === "SuperAdmin" || r.name === "Admin");

			return {
				id: u.id,
				email: u.email,
				fullName: u.fullName,
				isActive: u.isActive,
				isSuperAdmin: u.isSuperAdmin,
				isEmailVerified,
				hasAdminAccess,
				roles,
				permissions: [],
				createdAt: epochMs(Number(u.createdAt)),
				updatedAt: epochMs(Number(u.updatedAt)),
				isDeleted: u.isDeleted,
				deletedAt: u.deletedAt !== null ? epochMs(Number(u.deletedAt)) : null,
				failedLoginAttempts: u.failedLoginAttempts,
				lockedUntil: u.lockedUntil !== null ? epochMs(Number(u.lockedUntil)) : null,
			};
		});

		const totalPages: number = limit === 0 ? 0 : Math.ceil(total / limit);
		return {
			items,
			total,
			page,
			limit,
			totalPages,
			hasNext: page < totalPages,
			hasPrevious: page > 1,
		};
	}

	/**
	 * Unlock a user account by resetting the failed login counter and
	 * clearing the lockout timestamp.
	 *
	 * @param userId - The target user's ID
	 * @returns A confirmation message
	 */
	public async unlockUser(userId: string): Promise<MessageResponse> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});

		if (!user) throw new NotFoundException("User not found");

		await this.prisma.user.update({
			where: { id: userId },
			data: {
				failedLoginAttempts: 0,
				lockedUntil: null,
				updatedAt: Date.now(),
			},
		});

		this.logService.info("User account unlocked by admin", {
			context: "AuthService",
			metadata: { targetUserId: userId },
		});

		return { message: "User account has been unlocked successfully." };
	}

	/**
	 * Get a detailed user response with internal security fields.
	 * Intended for SuperAdmin use only — exposes `failedLoginAttempts`
	 * and `lockedUntil` alongside the standard user profile.
	 *
	 * @param userId - The target user's ID
	 * @returns AdminUserDetail with full user info + security fields
	 */
	public async getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				fullName: true,
				isActive: true,
				isSuperAdmin: true,
				emailVerifiedAt: true,
				createdAt: true,
				updatedAt: true,
				isDeleted: true,
				deletedAt: true,
				failedLoginAttempts: true,
				lockedUntil: true,
			},
		});

		if (!user) throw new NotFoundException("User not found");

		const userPermissions: UserPermissions = await this.rbacService.getUserPermissions(userId);
		const isEmailVerified: boolean = user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now();
		const baseUser: UserResponse = this.buildUserResponse(user, userPermissions, isEmailVerified);

		return {
			...baseUser,
			failedLoginAttempts: user.failedLoginAttempts,
			lockedUntil: user.lockedUntil !== null ? epochMs(Number(user.lockedUntil)) : null,
		};
	}

	// ── Private helpers ────────────────────────────────────────────────

	private async getUserResponse(userId: string): Promise<UserResponse> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				fullName: true,
				isActive: true,
				isSuperAdmin: true,
				emailVerifiedAt: true,
				createdAt: true,
				updatedAt: true,
				isDeleted: true,
				deletedAt: true,
			},
		});

		if (!user) throw new NotFoundException("User not found");

		const userPermissions = await this.rbacService.getUserPermissions(userId);
		const isEmailVerified = user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now();

		return this.buildUserResponse(user, userPermissions, isEmailVerified);
	}

	private async cleanupExpiredTokens(userId: string): Promise<void> {
		// Use a transaction to atomically soft-delete expired + excess tokens
		await this.prisma.$transaction(async (tx) => {
			// Soft-delete expired refresh tokens
			await tx.refreshToken.updateMany({
				where: { userId, expiresAt: { lt: Date.now() } },
				data: { isDeleted: true, deletedAt: Date.now() },
			});

			// Limit to 5 most recent tokens per user
			const excessTokens = await tx.refreshToken.findMany({
				where: { userId },
				orderBy: { createdAt: "desc" },
				skip: 5,
			});

			if (excessTokens.length > 0) {
				await tx.refreshToken.updateMany({
					where: { id: { in: excessTokens.map((t) => t.id) } },
					data: { isDeleted: true, deletedAt: Date.now() },
				});
			}
		});
	}

	/**
	 * Builds the canonical `UserResponse` (with roles + permissions) from a
	 * Prisma user row. `public` because the sibling `SessionsService` and
	 * `ImpersonationService` reuse it when constructing their own responses
	 * (token refresh / impersonation targets) — kept here so the shape lives
	 * in exactly one place.
	 */
	public buildUserResponse(
		user: Pick<UserResponse, "id" | "email" | "fullName" | "isActive" | "isSuperAdmin"> & {
			createdAt: bigint;
			updatedAt: bigint;
			isDeleted: boolean;
			deletedAt: bigint | null;
		},
		userPermissions: UserPermissions,
		isEmailVerified: boolean,
	): UserResponse {
		const hasAdminAccess: boolean = userPermissions.permissions.some((p) => p.resource === "ADMIN_DASHBOARD") || user.isSuperAdmin;

		return {
			id: user.id,
			email: user.email,
			fullName: user.fullName,
			isActive: user.isActive,
			isSuperAdmin: user.isSuperAdmin,
			isEmailVerified,
			hasAdminAccess,
			roles: userPermissions.roles.map(({ id, name, description }) => ({ id, name, description })),
			permissions: userPermissions.permissions,
			createdAt: epochMs(Number(user.createdAt)),
			updatedAt: epochMs(Number(user.updatedAt)),
			isDeleted: user.isDeleted,
			deletedAt: user.deletedAt !== null ? epochMs(Number(user.deletedAt)) : null,
		};
	}
}
