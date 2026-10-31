import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth, assertOwnsLead } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'

export interface TimelineEvent {
  id: string
  type: 'CALL' | 'STATUS_CHANGE' | 'FOLLOWUP' | 'MEETING' | 'WHATSAPP' | 'REASSIGNED' | 'CREATION'
  timestamp: string
  title: string
  description: string | null
  actor: { id?: string; displayName: string } | null
  metadata: Record<string, unknown> | null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const { id } = await params

    // Verify caller owns lead (or session is Admin)
    await assertOwnsLead(id, session.id)

    const [lead, calls, followUps, meetings, activityLogs] = await Promise.all([
      prisma.lead.findUnique({
        where: { id },
        include: {
          assignedTo: { select: { id: true, displayName: true } }
        }
      }),
      prisma.call.findMany({
        where: { leadId: id },
        orderBy: { calledAt: 'desc' },
        include: {
          user: { select: { id: true, displayName: true } }
        }
      }),
      prisma.followUp.findMany({
        where: { leadId: id },
        orderBy: { slot: 'asc' }
      }),
      prisma.meeting.findMany({
        where: { leadId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, displayName: true } }
        }
      }),
      prisma.activityLog.findMany({
        where: { entity: 'LEAD', entityId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, displayName: true } }
        }
      })
    ])

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const events: TimelineEvent[] = []

    // 1. Calls
    for (const call of calls) {
      events.push({
        id: `call-${call.id}`,
        type: 'CALL',
        timestamp: call.calledAt.toISOString(),
        title: `Call logged by ${call.user?.displayName || 'Caller'}`,
        description: call.notes || null,
        actor: call.user ? { id: call.user.id, displayName: call.user.displayName } : null,
        metadata: null
      })
    }

    // 2. Meetings
    for (const meeting of meetings) {
      events.push({
        id: `meeting-${meeting.id}`,
        type: 'MEETING',
        timestamp: meeting.createdAt.toISOString(),
        title: `${meeting.type === 'ONLINE' ? 'Online' : 'Offline'} Meeting scheduled by ${meeting.user?.displayName || 'Caller'}`,
        description: meeting.note || null,
        actor: meeting.user ? { id: meeting.user.id, displayName: meeting.user.displayName } : null,
        metadata: {
          meetingType: meeting.type,
          scheduledAt: meeting.scheduledAt ? meeting.scheduledAt.toISOString() : null
        }
      })
    }

    // 3. Follow-Ups
    for (const f of followUps) {
      if (f.scheduledAt) {
        events.push({
          id: `followup-${f.id}`,
          type: 'FOLLOWUP',
          timestamp: f.updatedAt.toISOString(),
          title: `Follow-up Slot ${f.slot} ${f.completed ? 'Completed' : 'Scheduled'}`,
          description: f.note || null,
          actor: null,
          metadata: {
            slot: f.slot,
            scheduledAt: f.scheduledAt.toISOString(),
            completed: f.completed
          }
        })
      }
    }

    // 4. Activity Logs (Status changes, WhatsApp, reassignments, manual creation)
    let hasCreationLog = false
    for (const log of activityLogs) {
      let meta: Record<string, unknown> | null = null
      try {
        if (log.metadata) meta = JSON.parse(log.metadata)
      } catch {
        meta = null
      }

      if (log.action === 'STATUS_CHANGE') {
        const toStatus = meta?.status ? String(meta.status) : 'Updated'
        const fromStatus = meta?.previousStatus ? String(meta.previousStatus) : null
        events.push({
          id: `log-${log.id}`,
          type: 'STATUS_CHANGE',
          timestamp: log.createdAt.toISOString(),
          title: `Status set to ${toStatus} by ${log.user?.displayName || 'User'}`,
          description: fromStatus ? `Previous status: ${fromStatus}` : null,
          actor: log.user ? { id: log.user.id, displayName: log.user.displayName } : null,
          metadata: meta
        })
      } else if (log.action === 'WHATSAPP_SENT') {
        events.push({
          id: `log-${log.id}`,
          type: 'WHATSAPP',
          timestamp: log.createdAt.toISOString(),
          title: `WhatsApp follow-up opened by ${log.user?.displayName || 'Caller'}`,
          description: null,
          actor: log.user ? { id: log.user.id, displayName: log.user.displayName } : null,
          metadata: meta
        })
      } else if (log.action === 'LEAD_REASSIGNED') {
        events.push({
          id: `log-${log.id}`,
          type: 'REASSIGNED',
          timestamp: log.createdAt.toISOString(),
          title: `Lead reassigned by ${log.user?.displayName || 'Admin'}`,
          description: null,
          actor: log.user ? { id: log.user.id, displayName: log.user.displayName } : null,
          metadata: meta
        })
      } else if (log.action === 'LEAD_CREATED') {
        hasCreationLog = true
        events.push({
          id: `log-${log.id}`,
          type: 'CREATION',
          timestamp: log.createdAt.toISOString(),
          title: `Lead created manually by ${log.user?.displayName || 'Admin'}`,
          description: null,
          actor: log.user ? { id: log.user.id, displayName: log.user.displayName } : null,
          metadata: meta
        })
      }
    }

    // 5. Initial Creation Event (if no ActivityLog creation record was stored)
    if (!hasCreationLog) {
      events.push({
        id: `lead-creation-${lead.id}`,
        type: 'CREATION',
        timestamp: lead.createdAt.toISOString(),
        title: lead.csvName ? `Imported from CSV (${lead.csvName})` : 'Lead added to system',
        description: null,
        actor: null,
        metadata: { csvName: lead.csvName }
      })
    }

    // Sort timeline strictly descending by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      lead: {
        id: lead.id,
        name: lead.name,
        contact: lead.contact,
        hasWebsite: lead.hasWebsite,
        status: lead.status,
        firstInterest: lead.firstInterest,
        customFields: lead.customFields,
        callCount: lead.callCount,
        lastCalledAt: lead.lastCalledAt?.toISOString() || null,
        whatsappSentAt: lead.whatsappSentAt?.toISOString() || null,
        createdAt: lead.createdAt.toISOString(),
        assignedTo: lead.assignedTo
      },
      events,
      summary: {
        totalCalls: calls.length,
        totalMeetings: meetings.length,
        totalFollowUps: followUps.filter(f => f.scheduledAt).length,
        currentStatus: lead.status
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}
