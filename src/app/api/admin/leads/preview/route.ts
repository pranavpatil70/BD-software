import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import * as xlsx from 'xlsx'
import prisma from '@/lib/prisma'
import { cleanPhoneNumber } from '@/lib/phone'

interface MappingConfig {
  name: string
  contact: string
  website?: string
  firstInterest?: string
  customFields: string[]
}

export async function POST(request: Request) {
  await requireAdmin()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const mappingRaw = formData.get('mapping') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = file.name.toLowerCase()
    let data: Record<string, unknown>[] = []

    // 1. Universal parsing (PDF vs Excel/CSV)
    if (fileName.endsWith('.pdf')) {
      try {
        await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

        const doc = await pdfjs.getDocument({
          data: new Uint8Array(buffer),
          standardFontDataUrl: undefined
        }).promise

        // ── Smart PDF Table Extractor ─────────────────────────────────────
        // Collects every text item from all pages with its raw (x, y) position.
        // Uses X-position column-boundary mapping (not line-text splitting) so
        // cells that wrap across two Y-coordinates are still merged correctly.
        // The title/subtitle lines above the table and footer notes below are
        // automatically excluded by detecting which line is the true header.
        const allItems: { str: string; x: number; y: number }[] = []
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p)
          const tc = await page.getTextContent()
          for (const item of tc.items as any[]) {
            if (!item.str || !item.str.trim()) continue
            allItems.push({ str: item.str.trim(), x: item.transform[4], y: item.transform[5] })
          }
        }

        if (allItems.length === 0) {
          return NextResponse.json({ error: 'PDF contains no extractable text' }, { status: 400 })
        }

        // Step 1: Cluster items into approximate lines (items within ±4 px Y are the same line)
        const lineBuckets: { y: number; items: { str: string; x: number; y: number }[] }[] = []
        for (const item of [...allItems].sort((a, b) => b.y - a.y)) {
          let placed = false
          for (const bucket of lineBuckets) {
            if (Math.abs(bucket.y - item.y) <= 4) {
              bucket.items.push(item)
              bucket.y = bucket.items.reduce((s, i) => s + i.y, 0) / bucket.items.length
              placed = true
              break
            }
          }
          if (!placed) lineBuckets.push({ y: item.y, items: [item] })
        }
        lineBuckets.sort((a, b) => b.y - a.y) // top → bottom

        // Step 2: Identify the real table header line
        // Score each line by how many known table-header keywords it contains
        // and how many distinct horizontal columns it spans.
        const headerKeywords = ['name', 'phone', 'contact', 'email', 'lead', 'id',
                                 'company', 'source', 'status', 'interest', 'mobile',
                                 'customer', 'client', 'number', 'address', 'city']
        let headerIndex = -1
        let maxScore = -1
        lineBuckets.forEach((b, idx) => {
          if (b.items.length < 2) return
          const lineText = b.items.map(i => i.str).join(' ').toLowerCase()
          let score = b.items.length // more columns = stronger signal
          for (const kw of headerKeywords) {
            if (lineText.includes(kw)) score += 2
          }
          if (score > maxScore && score >= 4) {
            maxScore = score
            headerIndex = idx
          }
        })

        if (headerIndex === -1) {
          // Fallback: treat first line with >1 items as header
          headerIndex = lineBuckets.findIndex(b => b.items.length > 1)
        }

        if (headerIndex === -1) {
          return NextResponse.json({ error: 'Could not identify a table header in the PDF' }, { status: 400 })
        }

        const headerLine = lineBuckets[headerIndex]
        const headerCols = [...headerLine.items].sort((a, b) => a.x - b.x)
        const headerY   = headerLine.y

        // Step 3: Build column X-boundaries (midpoints between adjacent header X-positions)
        const boundaries: number[] = []
        for (let i = 0; i < headerCols.length - 1; i++) {
          boundaries.push((headerCols[i].x + headerCols[i + 1].x) / 2)
        }
        const getColIndex = (x: number): number => {
          for (let i = 0; i < boundaries.length; i++) {
            if (x < boundaries[i]) return i
          }
          return headerCols.length - 1
        }

        // Step 4: Cluster data items (below the header) into rows
        // Items within ±10 px Y of each other belong to the same data row.
        // This correctly handles multi-line wrapped cells.
        const dataItems = allItems.filter(it => it.y < headerY - 5)
        const rowBuckets: { y: number; items: { str: string; x: number }[] }[] = []

        for (const item of [...dataItems].sort((a, b) => b.y - a.y)) {
          // Skip known footer/disclaimer patterns
          const lower = item.str.toLowerCase()
          if (/^(field guide|demo.?data notice|note:|page \d)/i.test(lower)) continue
          if (item.str.length > 120) continue // long disclaimer sentences

          let placed = false
          for (const r of rowBuckets) {
            if (Math.abs(r.y - item.y) <= 10) {
              r.items.push({ str: item.str, x: item.x })
              placed = true
              break
            }
          }
          if (!placed) rowBuckets.push({ y: item.y, items: [{ str: item.str, x: item.x }] })
        }

        // Step 5: Convert each row bucket into a Record<columnName, value>
        for (const r of rowBuckets) {
          const rowObj: Record<string, string> = {}
          headerCols.forEach(h => { rowObj[h.str] = '' })

          for (const item of r.items) {
            const colIdx  = getColIndex(item.x)
            const colName = headerCols[colIdx].str
            rowObj[colName] = rowObj[colName]
              ? rowObj[colName] + ' ' + item.str
              : item.str
          }

          const nonEmpty = Object.values(rowObj).filter(v => v.trim()).length
          if (nonEmpty >= 2) data.push(rowObj)
        }
        // ── End Smart PDF Table Extractor ─────────────────────────────────

      } catch (pdfErr: unknown) {
        return NextResponse.json({
          error: `Failed to parse PDF table: ${pdfErr instanceof Error ? pdfErr.message : 'Invalid PDF format'}`
        }, { status: 400 })
      }
    } else {
      // Excel (.xlsx, .xls) and CSV (.csv, .tsv, .ods)
      const wb = xlsx.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      data = xlsx.utils.sheet_to_json(ws, { defval: '' })
    }

    if (data.length === 0) {
      return NextResponse.json({ error: 'Uploaded file contains no data rows' }, { status: 400 })
    }

    // 2. Discover all columns across rows
    const allColumns = Array.from(
      new Set(
        data.flatMap(row => Object.keys(row).map(k => k.trim())).filter(Boolean)
      )
    )

    // 3. Resolve Column Mapping (Auto-detect or Admin-specified)
    let mapping: MappingConfig
    if (mappingRaw) {
      try {
        mapping = JSON.parse(mappingRaw)
      } catch {
        mapping = { name: '', contact: '', customFields: [] }
      }
    } else {
      // Auto-detect columns intelligently
      const nameCol = allColumns.find(c => /name|client|customer|lead/i.test(c)) || allColumns[0] || ''
      const contactCol = allColumns.find(c => /contact|phone|mobile|number|cell/i.test(c)) || allColumns.find(c => c !== nameCol) || ''
      const websiteCol = allColumns.find(c => /website|web|url|site/i.test(c)) || ''
      const firstInterestCol = allColumns.find(c => /interest|note|service|requirement|query|remark|desc/i.test(c)) || ''

      const coreCols = new Set([nameCol, contactCol, websiteCol, firstInterestCol].filter(Boolean))
      const autoCustomFields = allColumns.filter(c => !coreCols.has(c))

      mapping = {
        name: nameCol,
        contact: contactCol,
        website: websiteCol,
        firstInterest: firstInterestCol,
        customFields: autoCustomFields
      }
    }

    // 4. Pre-search database for duplicate phone numbers
    const dbSearchTerms = new Set<string>()
    for (const row of data) {
      const rawContact = String(row[mapping.contact] || '')
      const phoneRes = cleanPhoneNumber(rawContact)
      if (phoneRes.isValid && phoneRes.cleaned && phoneRes.national) {
        dbSearchTerms.add(phoneRes.cleaned)
        dbSearchTerms.add(phoneRes.national)
      }
      if (rawContact.trim()) {
        dbSearchTerms.add(rawContact.trim())
      }
    }

    const existingLeads = await prisma.lead.findMany({
      where: {
        contact: { in: Array.from(dbSearchTerms) }
      },
      select: { contact: true }
    })

    const existingContactsInDb = new Set<string>()
    for (const l of existingLeads) {
      const p = cleanPhoneNumber(l.contact)
      if (p.isValid && p.cleaned) {
        existingContactsInDb.add(p.cleaned)
      }
      existingContactsInDb.add(l.contact.trim().toLowerCase())
    }

    // 5. Parse and validate each row
    const parsedRows = []
    const seen = new Set<string>()

    for (const [index, row] of data.entries()) {
      const rawName = String(row[mapping.name] || '').trim()
      const rawContact = String(row[mapping.contact] || '').trim()
      const rawWebsite = mapping.website ? String(row[mapping.website] || '').trim().toLowerCase() : ''
      const firstInterest = mapping.firstInterest ? String(row[mapping.firstInterest] || '').trim() : ''

      // Extract dynamic custom fields
      const customFields: Record<string, string> = {}
      if (mapping.customFields && Array.isArray(mapping.customFields)) {
        for (const field of mapping.customFields) {
          const val = row[field]
          if (val !== undefined && val !== null && String(val).trim()) {
            customFields[field] = String(val).trim()
          }
        }
      }

      // Skip completely empty rows
      if (!rawName && !rawContact && !rawWebsite && Object.keys(customFields).length === 0) {
        continue
      }

      const phoneRes = cleanPhoneNumber(rawContact)
      const hasWebsite = ['yes', 'true', '1'].includes(rawWebsite)

      let status = 'valid'
      let reason = ''

      if (!rawName) {
        status = 'error'
        reason = 'Missing name'
      } else if (!phoneRes.isValid || !phoneRes.cleaned) {
        status = 'error'
        reason = phoneRes.reason || 'Invalid phone number'
      } else if (hasWebsite) {
        status = 'error'
        reason = 'Has a website'
      } else {
        const canonical = phoneRes.cleaned
        if (seen.has(canonical)) {
          status = 'error'
          reason = 'Duplicate in file'
        } else if (existingContactsInDb.has(canonical)) {
          status = 'error'
          reason = 'Already exists in database'
        } else {
          seen.add(canonical)
        }
      }

      parsedRows.push({
        rowNumber: index + 2,
        name: rawName,
        contact: phoneRes.cleaned || rawContact,
        hasWebsite,
        firstInterest: firstInterest || null,
        customFields,
        status,
        reason,
      })
    }

    return NextResponse.json({
      columns: allColumns,
      mapping,
      rows: parsedRows
    })
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message || 'Error parsing file' }, { status: 500 })
    }
    return NextResponse.json({ error: 'Error parsing file' }, { status: 500 })
  }
}
