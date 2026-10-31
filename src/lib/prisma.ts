import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client/web'
import { env } from './env' // We will create this in the next task

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function buildClient(): PrismaClient {
  if (env.TURSO_DATABASE_URL && env.TURSO_AUTH_TOKEN) {
    const libsql = createClient({ 
      url: env.TURSO_DATABASE_URL, 
      authToken: env.TURSO_AUTH_TOKEN 
    })
    const adapter = new PrismaLibSQL(libsql as any)
    return new PrismaClient({ adapter } as any)
  }
  // Local: standard SQLite
  return new PrismaClient()
}

export const prisma = globalForPrisma.prisma ?? buildClient()

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
