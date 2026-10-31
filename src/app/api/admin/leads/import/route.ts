import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { z } from 'zod'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { ApiError, handleApiError } from '@/lib/api-error'
import { cleanPhoneNumber } from '@/lib/phone'

const importSchema = z.object({
  rows: z.array(z.object({
    name: z.string().min(1),
    contact: z.string().min(1),
    hasWebsite: z.boolean(),
    firstInterest: z.string().optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),
  })).min(1, 'No rows to import'),
  assignedToId: z.string().optional().nullable(),
  csvName: z.string().optional().nullable(),
})

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    const key = rateLimitKey(request, 'import')
    const limit = checkRateLimit(key, 5)
    if (!limit.ok) {
      throw new ApiError(429, 'Too many import requests', { retryAfter: limit.retryAfter })
    }

    const body = await request.json()
    const data = importSchema.parse(body)

    // Query database for any matching contacts from the requested rows
    const dbSearchTerms = new Set<string>()
    for (const r of data.rows) {
      const p = cleanPhoneNumber(r.contact)
      if (p.isValid && p.cleaned && p.national) {
        dbSearchTerms.add(p.cleaned)
        dbSearchTerms.add(p.national)
      }
      if (r.contact) {
        dbSearchTerms.add(r.contact.trim())
      }
    }

    const existingLeads = await prisma.lead.findMany({
      where: {
        contact: {
          in: Array.from(dbSearchTerms)
        }
      },
      select: {
        contact: true
      }
    })
    const existingContactsInDb = new Set<string>()
    for (const l of existingLeads) {
      const p = cleanPhoneNumber(l.contact)
      if (p.isValid && p.cleaned) {
        existingContactsInDb.add(p.cleaned)
      }
      existingContactsInDb.add(l.contact.trim().toLowerCase())
    }

    const seenContacts = new Set<string>()
    const uniqueLeadsData = []

    for (const r of data.rows) {
      if (r.hasWebsite) {
        continue
      }
      const phoneRes = cleanPhoneNumber(r.contact)
      if (!phoneRes.isValid || !phoneRes.cleaned) {
        continue
      }
      const canonicalContact = phoneRes.cleaned
      if (existingContactsInDb.has(canonicalContact) || seenContacts.has(canonicalContact)) {
        continue
      }
      seenContacts.add(canonicalContact)
      uniqueLeadsData.push({
        name: r.name.trim(),
        contact: canonicalContact,
        hasWebsite: r.hasWebsite,
        firstInterest: r.firstInterest?.trim() || null,
        customFields: r.customFields && Object.keys(r.customFields).length > 0
          ? JSON.stringify(r.customFields)
          : null,
        assignedToId: data.assignedToId || null,
        status: 'NEW',
        csvName: data.csvName || null,
      })
    }

    let count = 0
    if (uniqueLeadsData.length > 0) {
      const result = await prisma.lead.createMany({
        data: uniqueLeadsData,
      })
      count = result.count
    }

    if (count > 0 && data.assignedToId) {
      await prisma.csvAssignment.create({
        data: {
          csvName: data.csvName || 'Direct Import',
          assignedToId: data.assignedToId,
        }
      })
    }

    await prisma.activityLog.create({
      data: {
        userId: session.id,
        action: 'LEADS_UPLOADED',
        entity: 'LEAD',
        metadata: JSON.stringify({ count, assignedToId: data.assignedToId })
      }
    })

    logger.info('lead.imported', { count, adminId: session.id })

    return NextResponse.json({ count })
  } catch (error) {
    return handleApiError(error)
  }
}
