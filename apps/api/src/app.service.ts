import { Injectable } from "@nestjs/common"
import { PrismaService } from "./prisma/prisma.service"
import { UserResponseSchema } from "@workspace/shared"
import type { SignupInput, UserResponse } from "@workspace/shared"

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return "Hello from the Freebuff API!"
  }

  async healthCheck(): Promise<{ status: string; db: string; timestamp: string }> {
    let dbStatus: string
    try {
      await this.prisma.$queryRaw`SELECT 1`
      dbStatus = "connected"
    } catch {
      dbStatus = "disconnected"
    }

    return {
      status: "ok",
      db: dbStatus,
      timestamp: new Date().toISOString(),
    }
  }

  async createUser(data: SignupInput): Promise<UserResponse> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        passwordHash: data.password,
      },
    })

    // Assign default "User" role
    const role = await this.prisma.role.findUnique({ where: { name: "User" } })
    if (role) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      })
    }

    return UserResponseSchema.parse({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
      isEmailVerified: user.emailVerifiedAt !== null,
      roles: role
        ? [{ id: role.id, name: role.name, description: role.description }]
        : [],
      permissions: [],
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      isDeleted: user.isDeleted,
      deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
    })
  }
}
