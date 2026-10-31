import { cookies, headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { redirect, forbidden, unauthorized } from 'next/navigation'
import { env } from '@/lib/env'
import { ApiError } from '@/lib/api-error'

export async function getSession() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(env.SESSION_COOKIE_NAME)?.value

  if (!sessionId) return null

  const user = await prisma.user.findUnique({
    where: { username: sessionId },
    select: { id: true, username: true, displayName: true, role: true, active: true }
  })

  if (!user || !user.active) return null

  return user
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    const headerList = await headers()
    const accept = headerList.get('accept') || ''
    const isPage = accept.includes('text/html')
    if (!isPage) {
      unauthorized()
    }
    redirect('/login')
  }
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  if (session.role !== 'ADMIN') {
    const headerList = await headers()
    const accept = headerList.get('accept') || ''
    const isPage = accept.includes('text/html')
    if (!isPage) {
      forbidden()
    }
    redirect('/dashboard')
  }
  return session
}

export async function requireUser() {
  const session = await requireAuth()
  if (session.role === 'ADMIN') {
    redirect('/admin')
  }
  return session
}

export async function assertOwnsLead(leadId: string, userId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId }
  })
  if (!lead) throw new ApiError(404, 'Lead not found')

  const user = await prisma.user.findUnique({ 
    where: { id: userId }, 
    select: { role: true } 
  })

  if (user?.role !== 'ADMIN' && lead.assignedToId !== userId) {
    throw new ApiError(403, 'Forbidden: You do not have access to this lead')
  }

  return lead
}
