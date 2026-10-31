import { requireAdmin } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { LeadsClient } from './LeadsClient'

export default async function LeadsPage() {
  await requireAdmin()
  
  const [users, unassignedCount, totalLeadsCount, pendingGroups, totalPendingCount, initialLeadsRaw] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { 
        id: true, 
        displayName: true, 
        username: true,
        avatar: true,
        _count: {
          select: { leads: true }
        }
      }
    }),
    prisma.lead.count({
      where: { assignedToId: null }
    }),
    prisma.lead.count(),
    prisma.lead.groupBy({
      by: ['assignedToId'],
      where: { callCount: 0 },
      _count: { _all: true }
    }),
    prisma.lead.count({
      where: { callCount: 0 }
    }),
    prisma.lead.findMany({
      skip: 0,
      take: 25,
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
      orderBy: { createdAt: 'desc' }
    })
  ])

  const pendingMap = new Map<string | null, number>()
  pendingGroups.forEach(g => {
    pendingMap.set(g.assignedToId, g._count._all)
  })

  const usersWithPending = users.map(u => ({
    ...u,
    pendingLeadsCount: pendingMap.get(u.id) || 0
  }))

  const unassignedPendingCount = pendingMap.get(null) || 0

  const initialRows = initialLeadsRaw.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lastCalledAt: r.lastCalledAt?.toISOString() || null,
    activeFollowUps: r._count.followUps,
    meetingsCount: r._count.meetings,
    whatsappSentAt: r.whatsappSentAt?.toISOString() || null,
    calls: r.calls.map(c => ({ ...c, calledAt: c.calledAt.toISOString() })),
    followUps: r.followUps.map(f => ({ ...f, scheduledAt: f.scheduledAt ? f.scheduledAt.toISOString() : '' }))
  }))

  return (
    <div className="space-y-6 w-full">
      <LeadsClient 
        users={usersWithPending} 
        unassignedCount={unassignedCount}
        unassignedPendingCount={unassignedPendingCount}
        totalLeadsCount={totalLeadsCount}
        totalPendingCount={totalPendingCount}
        initialRows={initialRows as any}
        initialTotalCount={totalLeadsCount}
      />
    </div>
  )
}
