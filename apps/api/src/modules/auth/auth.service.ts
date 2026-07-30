import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { parseExpiryToMilliseconds } from "../../common/utils/expiry";
import { LogService } from "../../modules/logs/logs.service";
import { UserPermissions } from "../../common/interfaces/rbac.interface";
import { TypedConfigService } from "../../config/typed-config.service";
import { RbacService } from "../rbac/rbac.service";
import {
	AdminUserDetail,
	ForgotPasswordInput,
	ForgotPasswordResponse,
	ImpersonateResponse,
	LoginInput,
	LoginServiceResponse,
	MessageResponse,
	RefreshResponse,
	ResendVerificationInput,
	ResendVerificationResponse,
	ResetPasswordInput,
	ResetPasswordResponse,
	Session,
	SessionSchema,
	SignupInput,
	SignupResponse,
	StopImpersonationResponse,
	UserResponse,
	VerifyEmailResponse,
} from "@workspace/shared";
import { CryptoService } from "./services/crypto.service";
import { EmailService } from "./services/email.service";
import { TokenService } from "./services/token.service";

@Injectable()
export class AuthService {
	constructor(
		private prisma: PrismaService,
		private tokenService: TokenService,
		private cryptoService: CryptoService,
		private config: TypedConfigService,
		private logService: LogService,
		private rbacService: RbacService,
		private emailService: EmailService,
	) {}

	public async signup(signupDto: SignupInput): Promise<SignupResponse> {
		const { email, password, fullName } = signupDto;

		const existingUser = await this.prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) throw new ConflictException("Email already in use");

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
		if (user && user.lockedUntil && user.lockedUntil > new Date()) {
			const remainingMs: number = user.lockedUntil.getTime() - Date.now();
			const remainingMin: number = Math.ceil(remainingMs / 60_000);
			throw new UnauthorizedException(`Account temporarily locked. Try again in ${remainingMin} minute(s).`);
		}
		// ─────────────────────────────────────────────────────────────────

		if (!user || !user.isActive || user.isDeleted || !passwordMatches) {
			// ── Increment failed attempt counter ───────────────────────
			if (user) {
				const MAX_FAILED_ATTEMPTS: number = 5;
				const LOCK_DURATION_MS: number = 15 * 60 * 1000; // 15 minutes
				const shouldLock: boolean = user.failedLoginAttempts + 1 >= MAX_FAILED_ATTEMPTS;
				const lockedUntil: Date = new Date(Date.now() + LOCK_DURATION_MS);

				await this.prisma.user.update({
					where: { id: user.id },
					data: {
						failedLoginAttempts: { increment: 1 },
						lockedUntil: shouldLock ? lockedUntil : undefined,
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

			throw new UnauthorizedException("Invalid email or password");
		}

		// ── Reset failed attempts on successful login ────────────────────
		if (user.failedLoginAttempts > 0 || user.lockedUntil) {
			await this.prisma.user.update({
				where: { id: user.id },
				data: {
					failedLoginAttempts: 0,
					lockedUntil: null,
				},
			});
		}

		// Get user permissions
		const userPermissions: UserPermissions = await this.rbacService.getUserPermissions(user.id);

		const isEmailVerified = user.emailVerifiedAt !== null && user.emailVerifiedAt <= new Date();
		const flatUser = this.buildUserResponse(user, userPermissions, isEmailVerified);

		// Create the refresh token record FIRST to get its ID (used as JWT jti)
		const expiryMs = parseExpiryToMilliseconds(this.config.jwtRefreshExpiry);
		const expiresAt = new Date(Date.now() + expiryMs);

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
			data: { token: hashedRt },
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

		return {
			user: flatUser,
			...tokens,
		};
	}

	public async refreshToken(userId: string, rawRefreshTokenJwt: string, refreshTokenJti: string, deviceInfo?: string, ipAddress?: string): Promise<RefreshResponse> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				isActive: true,
				isSuperAdmin: true,
				fullName: true,
				emailVerifiedAt: true,
				createdAt: true,
				updatedAt: true,
				isDeleted: true,
				deletedAt: true,
			},
		});

		if (!user) {
			throw new UnauthorizedException({
				message: "User account no longer exists. Please log in again.",
				error: "USER_NOT_FOUND",
			});
		}

		if (!user.isActive) {
			throw new UnauthorizedException({
				message: "Account is inactive. Please contact support.",
				error: "ACCOUNT_IS_INACTIVE",
			});
		}

		if (user.isDeleted) {
			throw new UnauthorizedException({
				message: "Account has been deleted. Please contact support.",
				error: "ACCOUNT_DELETED",
			});
		}

		// Look up the refresh token record directly by its ID (extracted from JWT jti claim)
		const storedToken = await this.prisma.refreshToken.findUnique({
			where: { id: refreshTokenJti },
		});

		if (!storedToken || storedToken?.userId !== userId) {
			throw new UnauthorizedException({
				message: "Invalid refresh token",
				error: "REFRESH_TOKEN_INVALID",
			});
		}

		if (storedToken.expiresAt < new Date()) {
			throw new UnauthorizedException("Refresh token has expired");
		}

		// ── Reuse Detection (Strategy 3) ────────────────────────────────────
		// Compare the incoming raw refresh token JWT against the stored bcrypt hash.
		// If they DON'T match, someone is using an OLD refresh token that was
		// already rotated — this indicates token theft.
		// ─────────────────────────────────────────────────────────────────────
		const tokenMatches = await this.cryptoService.compare(rawRefreshTokenJwt, storedToken.token);
		if (!tokenMatches) {
			this.logService.warn("Suspicious activity: token reuse detected — revoking all sessions", {
				userId: user.id,
				context: "AuthService",
				metadata: { tokenId: storedToken.id },
			});

			// Token theft detected — revoke ALL refresh tokens for this user
			await this.prisma.refreshToken.updateMany({
				where: { userId: user.id },
				data: { isDeleted: true, deletedAt: new Date() },
			});

			throw new UnauthorizedException({
				message: "Suspicious activity detected. All sessions have been revoked. Please log in again.",
				error: "TOKEN_THEFT_DETECTED",
			});
		}

		// Get user permissions
		const userPermissions = await this.rbacService.getUserPermissions(user.id);
		const isEmailVerified = user.emailVerifiedAt !== null && user.emailVerifiedAt <= new Date();
		const flatUser = this.buildUserResponse(user, userPermissions, isEmailVerified);

		// Update the existing refresh token record with new expiry and hashed token (rotation)
		const expiryMs = parseExpiryToMilliseconds(this.config.jwtRefreshExpiry);
		const expiresAt = new Date(Date.now() + expiryMs);

		const tokens = await this.tokenService.generateTokens(flatUser, storedToken.id);
		const hashedRt = await this.cryptoService.hash(tokens.refreshToken);

		await this.prisma.refreshToken.update({
			where: { id: storedToken.id },
			data: {
				token: hashedRt,
				deviceInfo: deviceInfo ?? storedToken.deviceInfo,
				ipAddress: ipAddress ?? storedToken.ipAddress,
				expiresAt,
			},
		});

		return tokens;
	}

	/**
	 * Logout from the specific device identified by the refresh token's jti.
	 */
	public async logoutDevice(userId: string, refreshTokenJti: string): Promise<void> {
		const storedToken = await this.prisma.refreshToken.findUnique({
			where: { id: refreshTokenJti },
		});

		if (storedToken?.userId === userId) {
			await this.prisma.refreshToken.update({
				where: { id: storedToken.id },
				data: { isDeleted: true, deletedAt: new Date() },
			});
		}
	}

	/**
	 * Logout from all devices — clears every refresh token for this user.
	 */
	public async logoutAllDevices(userId: string): Promise<void> {
		await this.prisma.refreshToken.updateMany({
			where: { userId },
			data: { isDeleted: true, deletedAt: new Date() },
		});
	}

	public async getMe(userId: string): Promise<UserResponse> {
		return this.getUserResponse(userId);
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// Active Sessions
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Get all active sessions (refresh tokens) for the current user.
	 * Returns device info, IP, creation date, and expiry date.
	 * Does NOT return the token hash.
	 */
	public async getSessions(userId: string): Promise<Session[]> {
		const tokens = await this.prisma.refreshToken.findMany({
			where: {
				userId,
				isDeleted: false,
				expiresAt: { gte: new Date() },
			},
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				deviceInfo: true,
				ipAddress: true,
				createdAt: true,
				expiresAt: true,
			},
		});

		// Convert Date objects to ISO strings before Zod validation.
		// SessionSchema expects `expiresAt` and `createdAt` as `z.string()`, but
		// Prisma returns native Date objects. Without this conversion, Zod throws.
		return tokens.map((t: { id: string; deviceInfo: string | null; ipAddress: string | null; createdAt: Date; expiresAt: Date }) =>
			SessionSchema.parse({
				id: t.id,
				deviceInfo: t.deviceInfo,
				ipAddress: t.ipAddress,
				createdAt: t.createdAt.toISOString(),
				expiresAt: t.expiresAt.toISOString(),
			}),
		);
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

		const user = await this.prisma.user.findUnique({
			where: { email },
			select: { id: true, email: true, isActive: true, isDeleted: true, deletedAt: true },
		});

		// Always return the same message regardless of whether the user exists
		// to prevent email enumeration attacks
		if (!user?.isActive || user?.isDeleted) {
			return { message: "If an account with that email exists, a password reset link has been sent." };
		}

		// Invalidate any existing unused tokens for this user
		await this.prisma.passwordResetToken.updateMany({
			where: { userId: user.id, usedAt: null, expiresAt: { gte: new Date() } },
			data: { expiresAt: new Date() }, // Expire existing tokens immediately
		});

		// Generate a cryptographically random token
		const rawToken = this.cryptoService.generateRandomToken();
		const tokenHash = await this.cryptoService.hash(rawToken);

		await this.prisma.passwordResetToken.create({
			data: {
				userId: user.id,
				token: tokenHash,
				expiresAt: new Date(Date.now() + 3_600_000), // 1 hour
			},
		});

		// Send email (fire-and-forget — never throw)
		await this.emailService.sendPasswordResetEmail(email, rawToken);

		return { message: "If an account with that email exists, a password reset link has been sent." };
	}

	/**
	 * Reset a user's password using a valid reset token.
	 */
	public async resetPassword(dto: ResetPasswordInput): Promise<ResetPasswordResponse> {
		const { token: rawToken, password } = dto;

		// Find all valid (unused, not expired) reset tokens
		const candidates = await this.prisma.passwordResetToken.findMany({
			where: {
				usedAt: null,
				expiresAt: { gte: new Date() },
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
			throw new UnauthorizedException("Invalid or expired reset token");
		}

		// Hash the new password and update the user
		const newPasswordHash = await this.cryptoService.hash(password);

		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: matchedToken.userId },
				data: { passwordHash: newPasswordHash },
			}),
			// Mark the token as used (one-time use)
			this.prisma.passwordResetToken.update({
				where: { id: matchedToken.id },
				data: { usedAt: new Date() },
			}),
		]);

		// Revoke all existing refresh tokens for this user (force re-login)
		await this.prisma.refreshToken.updateMany({
			where: { userId: matchedToken.userId },
			data: { isDeleted: true, deletedAt: new Date() },
		});

		this.logService.info("Password reset completed", {
			userId: matchedToken.userId,
			context: "AuthService",
			metadata: {
				userId: matchedToken.userId,
			},
		});

		return { message: "Password has been reset successfully. Please log in with your new password." };
	}

	/**
	 * Verify a user's email address using a verification token.
	 */
	public async verifyEmail(token: string): Promise<VerifyEmailResponse> {
		const email = await this.tokenService.verifyEmailToken(token);

		// Mark the user's email as verified
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (!user) {
			throw new NotFoundException("User not found");
		}

		if (user.emailVerifiedAt) {
			return { message: "Email already verified" };
		}

		await this.prisma.user.update({
			where: { email },
			data: { emailVerifiedAt: new Date() },
		});

		return { message: "Email verified successfully" };
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// Impersonation
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * SuperAdmin impersonates another user.
	 * Returns a short-lived access token for the target user with impersonation
	 * claims embedded in the JWT payload.
	 *
	 * Rules:
	 * - Only isSuperAdmin users can impersonate
	 * - Cannot impersonate other superadmins
	 * - Target user must exist and be active
	 */
	public async impersonateUser(superAdminId: string, targetUserId: string, ipAddress?: string, userAgent?: string | null): Promise<ImpersonateResponse> {
		// 1. Verify the impersonator is a superadmin
		const superAdmin = await this.prisma.user.findUnique({
			where: { id: superAdminId },
			select: { id: true, isSuperAdmin: true },
		});

		if (!superAdmin?.isSuperAdmin) {
			throw new ForbiddenException("Only super administrators can impersonate users");
		}

		// 2. Cannot impersonate yourself
		if (superAdminId === targetUserId) {
			throw new BadRequestException("Cannot impersonate yourself");
		}

		// 3. Verify target user exists, is active, and is not a superadmin
		const targetUser = await this.prisma.user.findUnique({
			where: { id: targetUserId },
			select: {
				id: true,
				email: true,
				fullName: true,
				isActive: true,
				isSuperAdmin: true,
				isDeleted: true,
				emailVerifiedAt: true,
				createdAt: true,
				updatedAt: true,
				deletedAt: true,
			},
		});

		if (!targetUser) {
			throw new NotFoundException("Target user not found");
		}

		if (!targetUser.isActive || targetUser.isDeleted) {
			throw new BadRequestException("Cannot impersonate an inactive or deleted user");
		}

		if (targetUser.isSuperAdmin) {
			throw new ForbiddenException("Cannot impersonate another super administrator");
		}

		// 4. Get target user's permissions
		const userPermissions = await this.rbacService.getUserPermissions(targetUser.id);
		const isEmailVerified = targetUser.emailVerifiedAt !== null && targetUser.emailVerifiedAt <= new Date();
		const flatUser = this.buildUserResponse(targetUser, userPermissions, isEmailVerified);

		// 5. Generate impersonation token
		const accessToken = await this.tokenService.generateImpersonationToken(flatUser, superAdmin.id);

		// 6. Persist audit log entry
		await this.prisma.impersonationAuditLog.create({
			data: {
				impersonatorId: superAdmin.id,
				targetUserId: targetUser.id,
				action: "START",
				ipAddress: ipAddress ?? null,
				userAgent: userAgent ?? null,
			},
		});

		// 7. Application-level audit log
		this.logService.warn("SuperAdmin impersonation started", {
			context: "AuthService",
			metadata: {
				superAdminId: superAdmin.id,
				targetUserId: targetUser.id,
			},
		});

		return {
			accessToken,
			message: `Now impersonating ${targetUser.email}`,
			impersonating: true,
			originalUserId: superAdmin.id,
			user: flatUser,
		};
	}

	/**
	 * Stop impersonating.
	 * Returns a confirmation message. The frontend should discard the
	 * impersonation token and restore the original session.
	 *
	 * @param impersonatorId - The SuperAdmin's original user ID (from originalUserId claim)
	 * @param targetUserId - The user who was being impersonated (from sub claim)
	 */
	public async stopImpersonation(impersonatorId: string, targetUserId: string, ipAddress?: string, userAgent?: string | null): Promise<StopImpersonationResponse> {
		// Persist audit log entry with both IDs correctly recorded
		await this.prisma.impersonationAuditLog.create({
			data: {
				impersonatorId,
				targetUserId,
				action: "STOP",
				ipAddress: ipAddress ?? null,
				userAgent: userAgent ?? null,
			},
		});

		this.logService.warn("SuperAdmin impersonation ended", {
			context: "AuthService",
			metadata: {
				impersonatorId: impersonatorId,
				targetUserId: targetUserId,
			},
		});

		return {
			message: "Impersonation ended. Original session restored.",
		};
	}

	/**
	 * Get a list of all users with their lockout status and roles.
	 * Intended for SuperAdmin use only.
	 *
	 * @returns Array of AdminUserDetail for every user in the system
	 */
	public async getAdminUsersList(): Promise<AdminUserDetail[]> {
		const users = await this.prisma.user.findMany({
			orderBy: { createdAt: "desc" },
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

		// Fetch all roles for all users in a single batch query
		const userIds: string[] = users.map((u) => u.id);
		const userRoles = await this.prisma.userRole.findMany({
			where: { userId: { in: userIds } },
			include: {
				role: { select: { id: true, name: true, description: true } },
			},
		});

		// Group roles by userId
		const rolesByUserId: Map<string, Array<{ id: string; name: string; description: string | null }>> = new Map();
		for (const ur of userRoles) {
			const existing = rolesByUserId.get(ur.userId) ?? [];
			existing.push({
				id: ur.role.id,
				name: ur.role.name,
				description: ur.role.description,
			});
			rolesByUserId.set(ur.userId, existing);
		}

		return users.map((u) => {
			const isEmailVerified: boolean = u.emailVerifiedAt !== null && u.emailVerifiedAt <= new Date();
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
				permissions: [], // Not fetched for list performance; use detail endpoint for full permissions
				createdAt: u.createdAt.toISOString(),
				updatedAt: u.updatedAt.toISOString(),
				isDeleted: u.isDeleted,
				deletedAt: u.deletedAt?.toISOString() ?? null,
				failedLoginAttempts: u.failedLoginAttempts,
				lockedUntil: u.lockedUntil?.toISOString() ?? null,
			};
		});
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
		const isEmailVerified: boolean = user.emailVerifiedAt !== null && user.emailVerifiedAt <= new Date();
		const baseUser: UserResponse = this.buildUserResponse(user, userPermissions, isEmailVerified);

		return {
			...baseUser,
			failedLoginAttempts: user.failedLoginAttempts,
			lockedUntil: user.lockedUntil?.toISOString() ?? null,
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
		const isEmailVerified = user.emailVerifiedAt !== null && user.emailVerifiedAt <= new Date();

		return this.buildUserResponse(user, userPermissions, isEmailVerified);
	}

	private async cleanupExpiredTokens(userId: string): Promise<void> {
		// Use a transaction to atomically soft-delete expired + excess tokens
		await this.prisma.$transaction(async (tx) => {
			// Soft-delete expired refresh tokens
			await tx.refreshToken.updateMany({
				where: { userId, expiresAt: { lt: new Date() } },
				data: { isDeleted: true, deletedAt: new Date() },
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
					data: { isDeleted: true, deletedAt: new Date() },
				});
			}
		});
	}

	private buildUserResponse(
		user: Pick<UserResponse, "id" | "email" | "fullName" | "isActive" | "isSuperAdmin"> & { createdAt: Date; updatedAt: Date; isDeleted: boolean; deletedAt: Date | null },
		userPermissions: UserPermissions,
		isEmailVerified: boolean,
	): UserResponse {
		const hasAdminAccess: boolean = user.isSuperAdmin || userPermissions.permissions.some((p) => p.resource === "ADMIN_DASHBOARD");

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
			createdAt: user.createdAt.toISOString(),
			updatedAt: user.updatedAt.toISOString(),
			isDeleted: user.isDeleted,
			deletedAt: user.deletedAt?.toISOString() ?? null,
		};
	}
}
