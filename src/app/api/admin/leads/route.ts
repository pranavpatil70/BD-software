import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { cleanPhoneNumber } from '@/lib/phone'
import { handleApiError } from '@/lib/api-error'

export async function GET(request: Request) {
  await requireAdmin()
  const { searchParams } = new URL(request.url)
  
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = 25
  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''
  const assignee = searchParams.get('assignee') || ''
  const website = searchParams.get('website') || ''
  const followupState = searchParams.get('followupState') || ''
  const firstInterest = searchParams.get('firstInterest') || ''
  const called = searchParams.get('called') || 'ALL'

  const where: Prisma.LeadWhereInput = {}

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { contact: { contains: q } }
    ]
  }

  if (status && status !== 'ALL') {
    where.status = status
  }

  if (assignee && assignee !== 'ALL') {
    if (assignee === 'UNASSIGNED') {
      where.assignedToId = null
    } else {
      where.assignedToId = assignee
    }
  }

  if (website && website !== 'ALL') {
    where.hasWebsite = website === 'YES'
  }

  if (called === 'CALLED') {
    where.callCount = { gt: 0 }
  } else if (called === 'NOT_CALLED') {
    where.callCount = 0
  }

  if (firstInterest && firstInterest !== 'ALL') {
    if (firstInterest === 'HAS') {
      where.firstInterest = { not: null, notIn: [''] }
    } else if (firstInterest === 'NONE') {
      where.OR = [
        ...(where.OR || []),
        { firstInterest: null },
        { firstInterest: '' }
      ]
    }
  }

  if (followupState && followupState !== 'ALL') {
    const now = new Date()
    if (followupState === 'SCHEDULED') {
      where.followUps = { some: { completed: false, scheduledAt: { gt: now } } }
    } else if (followupState === 'OVERDUE') {
      where.followUps = { some: { completed: false, scheduledAt: { lte: now } } }
    } else if (followupState === 'NONE') {
      where.followUps = { none: { scheduledAt: { not: null } } }
    }
  }

  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { 
        assignedTo: { select: { displayName: true } },
        calls: { orderBy: { calledAt: 'desc' }, take: 1, select: { calledAt: true, notes: true } },
        followUps: { where: { completed: false, scheduledAt: { not: null } }, orderBy: { scheduledAt: 'asc' }, take: 1, select: { slot: true, scheduledAt: true } },
        _count: { 
          select: { 
            followUps: { where: { completed: false } },
            meetings: true 
          } 
        }
      },
      orderBy: called === 'CALLED' ? { lastCalledAt: 'desc' } : { createdAt: 'desc' }
    }),
    prisma.lead.count({ where })
  ])

  const mappedRows = rows.map(r => ({
    ...r,
    activeFollowUps: r._count.followUps,
    meetingsCount: r._count.meetings,
    whatsappSentAt: r.whatsappSentAt?.toISOString() || null
  }))

  return NextResponse.json({ rows: mappedRows, total, page, pageSize })
}

const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  contact: z.string().min(1, 'Contact number is required').trim(),
  hasWebsite: z.boolean().default(false),
  assignedToId: z.string().nullable().optional(),
  firstInterest: z.string().nullable().optional(),
  status: z.string().default('NEW'),
})

export async function POST(request: Request) {
  const session = await requireAdmin()
  try {
    const body = await request.json()
    const data = createLeadSchema.parse(body)

    const phoneRes = cleanPhoneNumber(data.contact)
    if (!phoneRes.isValid || !phoneRes.cleaned) {
      return NextResponse.json(
        { error: phoneRes.reason || 'Invalid phone number format' },
        { status: 400 }
      )
    }

    const canonicalContact = phoneRes.cleaned
    const nationalContact = phoneRes.national || ''

    // Deduplication check: check canonical, national, and raw
    const existing = await prisma.lead.findFirst({
      where: {
        OR: [
          { contact: canonicalContact },
          ...(nationalContact ? [{ contact: nationalContact }] : []),
          { contact: data.contact }
        ]
      },
      select: { id: true, name: true, contact: true }
    })

    if (existing) {
      return NextResponse.json(
        { error: `A lead with contact ${canonicalContact} already exists (${existing.name})` },
        { status: 409 }
      )
    }

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        contact: canonicalContact,
        hasWebsite: data.hasWebsite,
        assignedToId: data.assignedToId || null,
        firstInterest: data.firstInterest?.trim() || null,
        status: data.status || 'NEW',
        csvName: 'Manual Entry',
      },
      include: {
        assignedTo: { select: { id: true, displayName: true } }
      }
    })

    await prisma.activityLog.create({
      data: {
        userId: session.id,
        action: 'LEAD_CREATED',
        entity: 'LEAD',
        entityId: lead.id,
        metadata: JSON.stringify({
          name: lead.name,
          contact: lead.contact,
          assignedToId: lead.assignedToId,
          source: 'MANUAL_ENTRY'
        })
      }
    })

    return NextResponse.json({ success: true, lead }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
