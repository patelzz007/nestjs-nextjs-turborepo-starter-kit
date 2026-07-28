import { Injectable } from "@nestjs/common"
import { PrismaService } from "./prisma/prisma.service"
import { CreateUserResponseSchema } from "@workspace/shared"
import type { CreateUser, CreateUserResponse } from "@workspace/shared"

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return "Hello from the Freebuff API!"
  }

  async healthCheck() {
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

  async createUser(data: CreateUser): Promise<CreateUserResponse> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        password: data.password,
      },
    })

    return CreateUserResponseSchema.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })
  }
}
