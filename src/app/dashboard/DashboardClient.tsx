'use client'

import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { CallButton } from '@/components/ui/CallButton'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { FollowUpDrawer } from './FollowUpDrawer'
import { MeetingDrawer } from '@/components/dashboard/MeetingDrawer'
import { useAutoSave } from '@/hooks/useAutoSave'
import { toast } from 'sonner'
import { Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LeadTimelineDrawer } from '@/components/leads/LeadTimelineDrawer'

// Basic types for the client table
interface Lead {
  id: string
  name: string
  contact: string
  hasWebsite: boolean
  status: string
  firstInterest: string | null
  callCount: number
  lastCalledAt: string | null
  activeFollowUps: number
  meetingsCount: number
  whatsappSentAt: string | null
  csvName?: string | null
}

// Helper to group adjacent items by csvName
function groupLeadsByCsv(leads: Lead[]) {
  const groups: { csvName: string; rows: Lead[] }[] = []
  leads.forEach(lead => {
    const groupName = lead.csvName || 'Direct Leads'
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.csvName === groupName) {
      lastGroup.rows.push(lead)
    } else {
      groups.push({ csvName: groupName, rows: [lead] })
    }
  })
  return groups
}

// Inline input with auto-save for First Interest

function InlineInterestEditor({ leadId, initialValue }: { leadId: string, initialValue: string }) {
  const [value, setValue] = useState(initialValue)
  
  const { status, save } = useAutoSave(async (newVal: string) => {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstInterest: newVal })
    })
    if (!res.ok) throw new Error('Failed to save interest')
  }, 500)

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => {
          setValue(e.target.value)
          save(e.target.value)
        }}
        className="h-8 text-sm border-transparent hover:border-gray-200 focus:border-black bg-transparent w-full min-w-[150px]"
        placeholder="Add note..."
      />
      {status !== 'idle' && (
        <span className={`absolute right-2 top-2 text-[10px] ${status === 'saving' ? 'text-gray-400' : status === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
          {status === 'saving' ? 'Saving...' : status === 'error' ? 'Error' : 'Saved'}
        </span>
      )}
    </div>
  )
}

// Inline status selector
function InlineStatusEditor({ leadId, initialStatus, onStatusChange }: { leadId: string, initialStatus: string, onStatusChange: () => void }) {
  const [statusVal, setStatusVal] = useState(initialStatus)
  const [isEditing, setIsEditing] = useState(false)

  const { status: saveStatus, saveImmediate } = useAutoSave(async (newStatus: string) => {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    if (!res.ok) throw new Error('Failed to update status')
    onStatusChange()
  })

  if (!isEditing) {
    return (
      <div 
        className="cursor-pointer inline-block" 
        onClick={() => setIsEditing(true)}
      >
        <StatusPill status={statusVal} />
        {saveStatus === 'saved' && <span className="ml-2 text-[10px] text-gray-400">Saved</span>}
        {saveStatus === 'error' && <span className="ml-2 text-[10px] text-red-500">Error</span>}
      </div>
    )
  }

  return (
    <Select
      autoFocus
      className="h-8 text-sm min-w-[140px]"
      value={statusVal}
      onChange={e => {
        setStatusVal(e.target.value)
        setIsEditing(false)
        saveImmediate(e.target.value)
      }}
      onBlur={() => setIsEditing(false)}
    >
      <option value="NEW">New</option>
      <option value="HOT">Hot</option>
      <option value="WARM">Warm</option>
      <option value="COLD">Cold</option>
      <option value="NOT_INTERESTED">Not Interested</option>
      <option value="CONVERTED">Converted</option>
      <option value="NOT_RECEIVED">Not Received</option>
    </Select>
  )
}

export function DashboardClient({ 
  bdName = 'Business Development Executive',
  initialLeads,
  initialTotal,
  initialPendingCount,
  initialCalledCount
}: { 
  bdName?: string
  initialLeads?: Lead[]
  initialTotal?: number
  initialPendingCount?: number
  initialCalledCount?: number
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads || [])
  const [total, setTotal] = useState(initialTotal || 0)
  const [loading, setLoading] = useState(!initialLeads)
  const [page, setPage] = useState(1)
  const [pendingCount, setPendingCount] = useState<number | null>(initialPendingCount ?? null)
  const [calledCount, setCalledCount] = useState<number | null>(initialCalledCount ?? null)
  const isInitialMount = React.useRef(true)
  
  // Filters
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [calledFilter, setCalledFilter] = useState('NOT_CALLED') // NOT_CALLED | CALLED
  const [websiteFilter, setWebsiteFilter] = useState('ALL') // ALL | YES | NO

  // Drawer state
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null)
  const [meetingDrawerLeadId, setMeetingDrawerLeadId] = useState<string | null>(null)
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null)

  const fetchLeads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        q,
        status: statusFilter,
        called: calledFilter,
        website: websiteFilter
      })
      const res = await fetch(`/api/leads/mine?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch leads')
      const json = await res.json()
      setLeads(json.rows)
      setTotal(json.total)
      if (json.pendingCount !== undefined) setPendingCount(json.pendingCount)
      if (json.calledCount !== undefined) setCalledCount(json.calledCount)
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [page, q, statusFilter, calledFilter, websiteFilter])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (initialLeads) return
    }
    fetchLeads()
  }, [fetchLeads, initialLeads])

  const hasFilters = q || statusFilter !== 'ALL' || websiteFilter !== 'ALL'
  const clearFilters = () => {
    setQ('')
    setStatusFilter('ALL')
    setWebsiteFilter('ALL')
    setPage(1)
  }

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return '—'
    // eslint-disable-next-line
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const updateLeadInList = (id: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  const handleCallLogged = useCallback((leadId: string, count: number, lastCalled: string) => {
    updateLeadInList(leadId, { callCount: count, lastCalledAt: lastCalled })
    if (calledFilter === 'NOT_CALLED') {
      setTimeout(() => {
        setCalledFilter('CALLED')
        setPage(1)
      }, 800)
    } else {
      setTimeout(() => {
        fetchLeads(true)
      }, 800)
    }
  }, [calledFilter, fetchLeads])

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => { setCalledFilter('NOT_CALLED'); setPage(1); }}
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center ${
            calledFilter === 'NOT_CALLED' 
              ? 'border-black text-black' 
              : 'border-transparent text-gray-400 hover:text-gray-900'
          }`}
        >
          Pending
          {pendingCount !== null && (
            <span className="font-normal text-xs text-gray-400 ml-1">({pendingCount})</span>
          )}
        </button>
        <button
          onClick={() => { setCalledFilter('CALLED'); setPage(1); }}
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center ${
            calledFilter === 'CALLED' 
              ? 'border-black text-black' 
              : 'border-transparent text-gray-400 hover:text-gray-900'
          }`}
        >
          Called
          {calledCount !== null && (
            <span className="font-normal text-xs text-gray-400 ml-1">({calledCount})</span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Input 
          placeholder="Search name or contact..." 
          value={q} 
          onChange={e => { setQ(e.target.value); setPage(1); }}
        />
        <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="ALL">All Statuses</option>
          <option value="NEW">New</option>
          <option value="HOT">Hot</option>
          <option value="WARM">Warm</option>
          <option value="COLD">Cold</option>
          <option value="NOT_INTERESTED">Not Interested</option>
          <option value="CONVERTED">Converted</option>
          <option value="NOT_RECEIVED">Not Received</option>
        </Select>
        <Select value={websiteFilter} onChange={e => { setWebsiteFilter(e.target.value); setPage(1); }}>
          <option value="ALL">Website: All</option>
          <option value="YES">Website: Yes</option>
          <option value="NO">Website: No</option>
        </Select>
        <div className="flex gap-2">
          {hasFilters && (
            <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
          )}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border border-gray-200 rounded-lg overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs sticky top-0">
            <tr>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Web</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium w-1/4">First Interest</th>
              <th className="px-4 py-3 font-medium">Message</th>
              <th className="px-4 py-3 font-medium">Meetings</th>
              <th className="px-4 py-3 font-medium">Follow-ups</th>
              <th className="px-4 py-3 font-medium">Timeline</th>
              <th className="px-4 py-3 font-medium text-right">Calls</th>
              <th className="px-4 py-3 font-medium text-right">Last Called</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading your leads...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-gray-500">
                  {hasFilters ? 'No leads match your filters.' : 'No leads assigned yet. Check back soon.'}
                </td>
              </tr>
            ) : (
              groupLeadsByCsv(leads).map(group => (
                <React.Fragment key={group.csvName}>
                  {/* Sticky Group Header Row */}
                  <tr className="sticky top-[37px] z-10">
                    <td colSpan={12} className="bg-gray-50/95 backdrop-blur-sm border-y border-gray-200/80 py-2 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600 font-mono text-left">
                      📁 {group.csvName}
                    </td>
                  </tr>
                  {group.rows.map(lead => (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors group border-b border-gray-100">
                      <td className="px-4 py-2 align-top">
                        <CallButton 
                          lead={lead}
                          onCallLogged={(count, lastCalled) => handleCallLogged(lead.id, count, lastCalled)}
                        />
                      </td>
                      <td className="px-4 py-2 align-top font-medium text-black">
                        {lead.name}
                      </td>
                      <td className="px-4 py-2 align-top text-gray-600 whitespace-nowrap">
                        {lead.contact.includes('@') ? (
                          <a href={`mailto:${lead.contact}`} className="hover:underline hover:text-black">{lead.contact}</a>
                        ) : (
                          <a href={`tel:${lead.contact}`} className="hover:underline hover:text-black">{lead.contact}</a>
                        )}
                      </td>
                      <td className="px-4 py-2 align-top">
                        {lead.hasWebsite ? <span className="text-xs bg-gray-100 px-2 py-1 rounded">Yes</span> : <span className="text-xs text-gray-400">No</span>}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <InlineStatusEditor 
                          leadId={lead.id} 
                          initialStatus={lead.status} 
                          onStatusChange={fetchLeads} 
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <InlineInterestEditor 
                          leadId={lead.id}
                          initialValue={lead.firstInterest || ''}
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        {!lead.contact.includes('@') && <WhatsAppButton lead={lead} bdName={bdName} />}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`h-8 text-xs whitespace-nowrap ${lead.meetingsCount > 0 ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800' : ''}`}
                          onClick={() => setMeetingDrawerLeadId(lead.id)}
                        >
                          {lead.meetingsCount > 0 ? 'Meeting Set ✓' : 'Set Meeting'}
                        </Button>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs relative whitespace-nowrap"
                          onClick={() => setDrawerLeadId(lead.id)}
                        >
                          Follow-ups ({lead.activeFollowUps}/4)
                        </Button>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs whitespace-nowrap flex items-center gap-1.5 text-gray-700 hover:text-black hover:border-gray-400"
                          onClick={() => setTimelineLeadId(lead.id)}
                          title="View lead activity timeline"
                        >
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          Timeline
                        </Button>
                      </td>
                      <td className="px-4 py-2 align-top text-right text-gray-500 font-mono">
                        {lead.callCount}
                      </td>
                      <td suppressHydrationWarning className="px-4 py-2 align-top text-right text-gray-500 whitespace-nowrap">
                        {formatRelativeTime(lead.lastCalledAt)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="py-12 text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading your leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="py-12 text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
            {hasFilters ? 'No leads match your filters.' : 'No leads assigned yet. Check back soon.'}
          </div>
        ) : (
          groupLeadsByCsv(leads).map(group => (
            <div key={group.csvName} className="space-y-4">
              {/* Sticky Group Header */}
              <div className="sticky top-0 z-10 -mx-4 px-4 bg-gray-50/95 backdrop-blur-sm border-y border-gray-200/80 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600 font-mono shadow-sm flex items-center gap-2">
                📁 {group.csvName}
              </div>
              {group.rows.map(lead => (
                <div key={lead.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-black">{lead.name}</h3>
                      <div className="text-gray-600 text-sm mt-0.5">
                        {lead.contact.includes('@') ? (
                          <a href={`mailto:${lead.contact}`} className="hover:underline hover:text-black">{lead.contact}</a>
                        ) : (
                          <a href={`tel:${lead.contact}`} className="hover:underline hover:text-black">{lead.contact}</a>
                        )}
                      </div>
                    </div>
                    <CallButton 
                      lead={lead}
                      onCallLogged={(count, lastCalled) => handleCallLogged(lead.id, count, lastCalled)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs block mb-1">Status</span>
                      <InlineStatusEditor 
                        leadId={lead.id} 
                        initialStatus={lead.status} 
                        onStatusChange={fetchLeads} 
                      />
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs block mb-1">Website</span>
                      {lead.hasWebsite ? <span className="text-xs bg-gray-100 px-2 py-1 rounded">Yes</span> : <span className="text-xs text-gray-400">No</span>}
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-500 text-xs block mb-1">First Interest</span>
                    <InlineInterestEditor 
                      leadId={lead.id}
                      initialValue={lead.firstInterest || ''}
                    />
                  </div>

                  <div className="pt-3 border-t border-gray-100 mt-2 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {!lead.contact.includes('@') && (
                        <WhatsAppButton lead={lead} bdName={bdName} className="flex-1 min-w-[120px] h-8 text-xs" />
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`flex-1 min-w-[120px] h-8 text-xs ${lead.meetingsCount > 0 ? 'bg-green-50 text-green-700 border-green-200' : ''}`}
                        onClick={() => setMeetingDrawerLeadId(lead.id)}
                      >
                        {lead.meetingsCount > 0 ? 'Meeting Set ✓' : 'Set Meeting'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 min-w-[120px] h-8 text-xs"
                        onClick={() => setDrawerLeadId(lead.id)}
                      >
                        Follow-ups ({lead.activeFollowUps}/4)
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 min-w-[120px] h-8 text-xs flex items-center justify-center gap-1 text-gray-700 hover:text-black"
                        onClick={() => setTimelineLeadId(lead.id)}
                      >
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        Timeline
                      </Button>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-xs text-gray-500">
                      <div>Calls: <span className="font-mono text-gray-700">{lead.callCount}</span></div>
                      <div suppressHydrationWarning>Last called: {formatRelativeTime(lead.lastCalledAt)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && total > 25 && (
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-gray-500">
            Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Drawers */}
      {drawerLeadId && (
        <FollowUpDrawer 
          leadId={drawerLeadId}
          leadName={leads.find(l => l.id === drawerLeadId)?.name || 'Lead'}
          onClose={() => {
            setDrawerLeadId(null)
            fetchLeads() // refresh to update activeFollowUps count
          }} 
        />
      )}

      {meetingDrawerLeadId && (
        <MeetingDrawer 
          leadId={meetingDrawerLeadId}
          leadName={leads.find(l => l.id === meetingDrawerLeadId)?.name || 'Lead'}
          onClose={() => {
            setMeetingDrawerLeadId(null)
            fetchLeads()
          }}
        />
      )}

      {timelineLeadId && (
        <LeadTimelineDrawer 
          leadId={timelineLeadId}
          leadName={leads.find(l => l.id === timelineLeadId)?.name || 'Lead'}
          onClose={() => setTimelineLeadId(null)}
        />
      )}

    </div>
  )
}
