import { NextResponse } from 'next/server'
import { requireAuth, assertOwnsLead } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    await assertOwnsLead(id, session.id)

    const meetings = await prisma.meeting.findMany({
      where: { leadId: id },
      include: {
        user: { select: { id: true, displayName: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ meetings })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    await assertOwnsLead(id, session.id)

    const body = await request.json()
    const { type, scheduledAt, note } = body

    if (!['ONLINE', 'OFFLINE'].includes(type)) {
      return NextResponse.json({ error: 'Invalid meeting type' }, { status: 400 })
    }

    const meeting = await prisma.meeting.create({
      data: {
        leadId: id,
        userId: session.id,
        type,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        note
      },
      include: {
        user: { select: { id: true, displayName: true } }
      }
    })

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: session.id,
        action: 'MEETING_SET',
        entity: 'LEAD',
        entityId: id,
        metadata: JSON.stringify({ type, scheduledAt })
      }
    })

    return NextResponse.json({ success: true, meeting })
  } catch (error) {
    return handleApiError(error)
  }
}
