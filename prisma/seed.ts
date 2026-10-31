import prisma from '../src/lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('Seeding database with secure passwords...')

  const adminPasswordHash = await bcrypt.hash('Admin@123', 10)
  const callerPasswordHash = await bcrypt.hash('Caller@123', 10)

  // Create Admin
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminPasswordHash },
    create: {
      username: 'admin',
      displayName: 'Admin',
      role: 'ADMIN',
      passwordHash: adminPasswordHash,
    },
  })

  // Create piyush (Admin)
  const piyush = await prisma.user.upsert({
    where: { username: 'piyush' },
    update: { passwordHash: adminPasswordHash },
    create: {
      username: 'piyush',
      displayName: 'Piyush',
      role: 'ADMIN',
      passwordHash: adminPasswordHash,
    },
  })

  // Create User 1: alice
  const alice = await prisma.user.upsert({
    where: { username: 'alice' },
    update: { passwordHash: callerPasswordHash },
    create: {
      username: 'alice',
      displayName: 'Alice',
      role: 'USER',
      passwordHash: callerPasswordHash,
    },
  })

  // Create User 2: bob
  const bob = await prisma.user.upsert({
    where: { username: 'bob' },
    update: { passwordHash: callerPasswordHash },
    create: {
      username: 'bob',
      displayName: 'Bob',
      role: 'USER',
      passwordHash: callerPasswordHash,
    },
  })

  console.log({ admin, piyush, alice, bob })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
