"use client"

import * as React from 'react'
import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { StatusPill } from '@/components/ui/StatusPill'
import { Dialog } from '@/components/ui/Dialog'
import { toast } from 'sonner'
import { MoreHorizontal, Loader2, Download, User, Users, FileText, ArrowRight, List, LayoutGrid, UserPlus, Clock } from 'lucide-react'
import { LeadDetailDrawer } from '@/components/admin/LeadDetailDrawer'
import { AdminFollowUpsDrawer } from '@/components/admin/AdminFollowUpsDrawer'
import { ExportLeadsDialog } from '@/components/leads/ExportLeadsDialog'
import { AddLeadDialog } from '@/components/admin/AddLeadDialog'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { MeetingDrawer } from '@/components/dashboard/MeetingDrawer'
import { LeadTimelineDrawer } from '@/components/leads/LeadTimelineDrawer'
import { cn } from '@/lib/utils'

import { usePolling } from '@/hooks/usePolling'

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
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


interface Lead {
  id: string
  name: string
  contact: string
  hasWebsite: boolean
  status: string
  assignedToId: string | null
  assignedTo: { displayName: string } | null
  callCount: number
  lastCalledAt: string | null
  createdAt: string
  updatedAt: string
  firstInterest: string | null
  activeFollowUps: number
  meetingsCount: number
  whatsappSentAt: string | null
  calls: Array<{ calledAt: string, notes: string | null }>
  followUps: Array<{ slot: number, scheduledAt: string }>
  csvName?: string | null
}



export function LeadsClientInner({ 
  users, 
  unassignedCount = 0,
  unassignedPendingCount = 0,
  totalLeadsCount = 0,
  totalPendingCount = 0,
  initialAssigneeFilter = 'ALL',
  initialRows,
  initialTotalCount
}: { 
  users: { id: string, displayName: string, username?: string, pendingLeadsCount?: number, avatar?: string | null, _count?: { leads: number } }[]
  unassignedCount?: number
  unassignedPendingCount?: number
  totalLeadsCount?: number
  totalPendingCount?: number
  initialAssigneeFilter?: string
  initialRows?: Lead[]
  initialTotalCount?: number
}) {
  const [data, setData] = useState<{ rows: Lead[], total: number, page: number, pageSize: number }>({
    rows: initialRows || [], total: initialTotalCount ?? 0, page: 1, pageSize: 25
  })
  const [loading, setLoading] = useState(!initialRows || initialRows.length === 0)
  const isInitialMount = useRef(true)
  const [changedRowIds, setChangedRowIds] = useState<Set<string>>(new Set())

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adminLeadsViewMode')
      if (saved === 'list' || saved === 'grid') {
        setViewMode(saved)
      }
    }
  }, [])

  const setAndSaveViewMode = (mode: 'list' | 'grid') => {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('adminLeadsViewMode', mode)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingUserId, setUploadingUserId] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadingUserId) return

    if (file.size > 1024 * 1024) {
      toast.error('Image size must be less than 1MB')
      e.target.value = ''
      setUploadingUserId(null)
      return
    }

    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64String = reader.result as string
      try {
        const res = await fetch(`/api/admin/users/${uploadingUserId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: base64String })
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to upload photo')
        }
        toast.success('Profile photo updated successfully')
        router.refresh()
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload photo')
      } finally {
        setUploadingUserId(null)
        e.target.value = ''
      }
    }
    reader.onerror = () => {
      toast.error('Failed to read file')
      setUploadingUserId(null)
      e.target.value = ''
    }
    reader.readAsDataURL(file)
  }

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const hasAssigneeParam = searchParams.has('assignee') || (initialAssigneeFilter !== 'ALL')
  const assigneeFilter = searchParams.get('assignee') || initialAssigneeFilter || 'ALL'
  const calledFilter = searchParams.get('called') || (assigneeFilter === 'ALL' ? 'ALL' : 'NOT_CALLED')

  const q = searchParams.get('q') || ''
  const statusFilter = searchParams.get('status') || 'ALL'
  const websiteFilter = searchParams.get('website') || 'ALL'
  const followupStateFilter = searchParams.get('followupState') || 'ALL'
  const firstInterestFilter = searchParams.get('firstInterest') || 'ALL'
  const pageStr = searchParams.get('page')
  const page = pageStr ? parseInt(pageStr) : 1

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === '') {
      params.delete(key)
    } else if (value === 'ALL' && key !== 'assignee' && key !== 'called') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    if (key !== 'page') params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  function selectAssignee(id: string | null) {
    const params = new URLSearchParams()
    if (id !== null) {
      params.set('assignee', id)
      params.set('called', id === 'ALL' ? 'ALL' : 'NOT_CALLED')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedLeadIdForDrawer, setSelectedLeadIdForDrawer] = useState<string | null>(null)
  const [selectedFollowUpsLeadId, setSelectedFollowUpsLeadId] = useState<string | null>(null)
  const [meetingDrawerLeadId, setMeetingDrawerLeadId] = useState<string | null>(null)
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkAssignTo, setBulkAssignTo] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [targetDeleteId, setTargetDeleteId] = useState<string | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [addLeadOpen, setAddLeadOpen] = useState(false)

  const isPaused = !hasAssigneeParam || bulkAssignOpen || deleteConfirmOpen || selectedIds.size > 0 || !!selectedLeadIdForDrawer || !!selectedFollowUpsLeadId || !!meetingDrawerLeadId || !!timelineLeadId || exportDialogOpen || addLeadOpen

  const fetcher = useCallback(async () => {
    if (!searchParams.has('assignee') && initialAssigneeFilter === 'ALL') {
      return { rows: [], total: 0, page: 1, pageSize: 25 }
    }
    const params = new URLSearchParams(searchParams.toString())
    if (!params.has('page')) params.set('page', '1')
    if (!params.has('assignee')) {
      params.set('assignee', initialAssigneeFilter)
    }
    if (!params.has('called')) {
      params.set('called', params.get('assignee') === 'ALL' ? 'ALL' : 'NOT_CALLED')
    }
    const res = await fetch(`/api/admin/leads?${params.toString()}`)
    if (!res.ok) throw new Error('Failed to fetch leads')
    return await res.json()
  }, [searchParams, initialAssigneeFilter])

  const { data: polledData, refetch: fetchLeads } = usePolling(fetcher, 30000, isPaused)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (initialRows && initialRows.length > 0 && !searchParams.toString()) {
        return
      }
    }
    setLoading(true)
    fetchLeads()
  }, [searchParams, fetchLeads, initialRows])

  useEffect(() => {
    if (polledData) {
      // eslint-disable-next-line
      setData(prev => {
        if (prev.rows.length > 0 && polledData.rows.length > 0) {
          const oldRowsMap = new Map(prev.rows.map(r => [r.id, r]))
          const changedIds = new Set<string>()
          
          polledData.rows.forEach((newRow: Lead) => {
            const oldRow = oldRowsMap.get(newRow.id)
            if (oldRow) {
              if (
                oldRow.status !== newRow.status || 
                oldRow.callCount !== newRow.callCount || 
                oldRow.lastCalledAt !== newRow.lastCalledAt
              ) {
                changedIds.add(newRow.id)
              }
            }
          })
          
          if (changedIds.size > 0) {
            setChangedRowIds(changedIds)
            setTimeout(() => setChangedRowIds(new Set()), 1500)
          }
        }
        return polledData
      })
      setLoading(false)
    }
  }, [polledData])

  const toggleSelectAll = () => {
    if (selectedIds.size === data.rows.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.rows.map(r => r.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const handleBulkReassign = async () => {
    try {
      const res = await fetch('/api/admin/leads/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), assignedToId: bulkAssignTo || null })
      })
      if (!res.ok) throw new Error('Failed to reassign')
      toast.success('Leads reassigned')
      setBulkAssignOpen(false)
      setSelectedIds(new Set())
      fetchLeads()
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message)
    }
  }

  const handleDelete = async () => {
    try {
      const isBulk = targetDeleteId === null
      const url = isBulk ? '/api/admin/leads/bulk' : `/api/admin/leads/${targetDeleteId}`
      const method = 'DELETE'
      const body = isBulk ? JSON.stringify({ ids: Array.from(selectedIds) }) : undefined

      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success(isBulk ? 'Leads deleted' : 'Lead deleted')
      setDeleteConfirmOpen(false)
      if (isBulk) setSelectedIds(new Set())
      fetchLeads()
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message)
    }
  }

  const handleSingleReassign = async (id: string, newAssigneeId: string) => {
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: newAssigneeId || null })
      })
      if (!res.ok) throw new Error('Failed to reassign lead')
      toast.success('Lead reassigned')
      fetchLeads()
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message)
    }
  }

  if (!hasAssigneeParam) {
    return (
      <div className="space-y-8 max-w-6xl mx-auto py-4">
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileChange} 
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-5 gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-extrabold tracking-tight text-black">Leads Management</h1>
            <p className="text-gray-500 mt-1 text-sm sm:text-base">Select a Business Development executive or segment to manage active leads.</p>
          </div>
          
          <div className="flex items-center gap-3 self-center sm:self-auto">
            <Button
              onClick={() => setAddLeadOpen(true)}
              className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 text-xs h-8 px-3 shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Single Lead</span>
            </Button>

            <div className="flex items-center justify-center border border-gray-200 rounded-lg p-0.5 bg-gray-50 shadow-sm">
              <button
                onClick={() => setAndSaveViewMode('list')}
                className={`flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === 'list' 
                    ? 'bg-black text-white shadow-sm' 
                    : 'text-gray-500 hover:text-black'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
              <button
                onClick={() => setAndSaveViewMode('grid')}
                className={`flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === 'grid' 
                    ? 'bg-black text-white shadow-sm' 
                    : 'text-gray-500 hover:text-black'
                }`}
                title="Compact Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Compact Tiles</span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'list' ? (
          <div className="max-w-3xl ml-0 mr-auto space-y-3 pt-2">
            {/* All Leads Row */}
            <div 
              onClick={() => selectAssignee('ALL')}
              className="group border border-gray-200 hover:border-black bg-white rounded-xl p-3.5 transition-all duration-300 cursor-pointer flex items-center justify-between shadow-sm hover:shadow-md animate-fade-in"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-black group-hover:bg-black group-hover:text-white transition-colors duration-300">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black flex items-center gap-2">
                    All Leads
                    <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1.5" title="Called / Total leads (Pending count)">
                      <span>{totalLeadsCount - totalPendingCount} / {totalLeadsCount}</span>
                      <span className="text-gray-400 font-normal">({totalPendingCount} pending)</span>
                    </span>
                  </h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    View global database. Perfect for master queries and bulk operations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-black pr-2">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 mr-1 hidden sm:inline">Open</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Unassigned Leads Row */}
            <div 
              onClick={() => selectAssignee('UNASSIGNED')}
              className="group border border-gray-200 hover:border-black bg-white rounded-xl p-3.5 transition-all duration-300 cursor-pointer flex items-center justify-between shadow-sm hover:shadow-md animate-fade-in"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-black group-hover:bg-black group-hover:text-white transition-colors duration-300">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black flex items-center gap-2">
                    Unassigned Leads
                    <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1.5" title="Called / Total leads (Pending count)">
                      <span>{unassignedCount - unassignedPendingCount} / {unassignedCount}</span>
                      <span className="text-gray-400 font-normal">({unassignedPendingCount} pending)</span>
                    </span>
                  </h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Newly uploaded leads not yet assigned to any BD Executive.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-black pr-2">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 mr-1 hidden sm:inline">Open</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* User Rows */}
            {users.map(u => (
              <div 
                key={u.id}
                onClick={() => selectAssignee(u.id)}
                className="group border border-gray-200 hover:border-black bg-white rounded-xl p-3.5 transition-all duration-300 cursor-pointer flex items-center justify-between shadow-sm hover:shadow-md animate-fade-in"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-black transition-colors duration-300 relative group-hover:bg-black group-hover:text-white shrink-0">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.displayName} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadingUserId(u.id);
                        fileInputRef.current?.click();
                      }}
                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-black text-white text-[9px] rounded-full flex items-center justify-center cursor-pointer border border-white hover:bg-gray-800 shadow-sm font-bold z-10"
                      title="Upload photo"
                    >
                      +
                    </button>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-black flex items-center gap-2 flex-wrap">
                      <span>{u.displayName}</span>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1.5" title="Called / Assigned leads (Pending count)">
                        <span>{(u._count?.leads || 0) - (u.pendingLeadsCount || 0)} / {u._count?.leads || 0}</span>
                        <span className="text-gray-400 font-normal">({u.pendingLeadsCount || 0} pending)</span>
                      </span>
                    </h3>
                    {u.username ? (
                      <p className="text-gray-400 text-xs mt-0.5 font-mono">
                        @{u.username} • BD Executive
                      </p>
                    ) : (
                      <p className="text-gray-400 text-xs mt-0.5">
                        BD Executive
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-black pr-2">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 mr-1 hidden sm:inline">View Leads</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
            {/* All Leads Compact Tile */}
            <div 
              onClick={() => selectAssignee('ALL')}
              className="group border border-gray-200 hover:border-black bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md cursor-pointer flex flex-col justify-between h-[120px] animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-black group-hover:bg-black group-hover:text-white transition-colors duration-300">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-[11px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full font-mono font-semibold flex flex-col items-end" title="Called / Total leads (Pending count)">
                  <span>{totalLeadsCount - totalPendingCount}/{totalLeadsCount}</span>
                  <span className="text-[9px] text-gray-400 font-normal">({totalPendingCount} pending)</span>
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-black truncate">
                  All Leads
                </h3>
                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                  Global Database <ArrowRight className="w-2.5 h-2.5 transform group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>

            {/* Unassigned Leads Compact Tile */}
            <div 
              onClick={() => selectAssignee('UNASSIGNED')}
              className="group border border-gray-200 hover:border-black bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md cursor-pointer flex flex-col justify-between h-[120px] animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-black group-hover:bg-black group-hover:text-white transition-colors duration-300">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-[11px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full font-mono font-semibold flex flex-col items-end" title="Called / Total leads (Pending count)">
                  <span>{unassignedCount - unassignedPendingCount}/{unassignedCount}</span>
                  <span className="text-[9px] text-gray-400 font-normal">({unassignedPendingCount} pending)</span>
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-black truncate">
                  Unassigned
                </h3>
                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                  Inbox Leads <ArrowRight className="w-2.5 h-2.5 transform group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>

            {/* User Compact Tiles */}
            {users.map(u => (
              <div 
                key={u.id}
                onClick={() => selectAssignee(u.id)}
                className="group border border-gray-200 hover:border-black bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md cursor-pointer flex flex-col justify-between h-[120px] animate-fade-in"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-black transition-colors duration-300 relative group-hover:bg-black group-hover:text-white shrink-0">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.displayName} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadingUserId(u.id);
                        fileInputRef.current?.click();
                      }}
                      className="absolute -bottom-1 -right-1 w-3 h-3 bg-black text-white text-[8px] rounded-full flex items-center justify-center cursor-pointer border border-white hover:bg-gray-800 shadow-sm font-bold z-10"
                      title="Upload photo"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[11px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full font-mono font-semibold flex flex-col items-end" title="Called / Assigned leads (Pending count)">
                    <span>{(u._count?.leads || 0) - (u.pendingLeadsCount || 0)}/{(u._count?.leads || 0)}</span>
                    <span className="text-[9px] text-gray-400 font-normal">({u.pendingLeadsCount || 0} pending)</span>
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black truncate">
                    {u.displayName}
                  </h3>
                  <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-0.5 truncate">
                    {u.username ? `@${u.username}` : 'Executive'} <ArrowRight className="w-2.5 h-2.5 transform group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <AddLeadDialog
          open={addLeadOpen}
          onClose={() => setAddLeadOpen(false)}
          users={users}
          defaultAssigneeId={null}
          onLeadCreated={() => {
            router.refresh()
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2 text-xs h-8 cursor-pointer animate-fade-in" 
          onClick={() => selectAssignee(null)}
        >
          ← Change Executive
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black flex items-center gap-2">
            {assigneeFilter === 'ALL' ? (
              'All Assignees'
            ) : assigneeFilter === 'UNASSIGNED' ? (
              'Unassigned Leads'
            ) : (
              <>
                Leads for <span className="underline decoration-black decoration-2 underline-offset-4">{users.find(u => u.id === assigneeFilter)?.displayName || 'BD Executive'}</span>
              </>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {assigneeFilter === 'ALL' ? (
              'Viewing all system-wide leads.'
            ) : assigneeFilter === 'UNASSIGNED' ? (
              'Viewing leads that have not been assigned to any executive.'
            ) : (
              `Viewing active leads assigned to ${users.find(u => u.id === assigneeFilter)?.displayName || 'BD Executive'}.`
            )}
          </p>
        </div>
        
        {/* Actions & Tabs */}
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <Button
            onClick={() => setAddLeadOpen(true)}
            className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 text-xs h-8 px-3 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Single Lead</span>
          </Button>

          {/* Called / Pending tabs */}
          <div className="flex border border-gray-200 rounded-lg p-0.5 bg-gray-50">
          <button
            onClick={() => setParam('called', 'NOT_CALLED')}
            className={`py-1.5 px-4 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              calledFilter === 'NOT_CALLED' 
                ? 'bg-black text-white shadow-sm' 
                : 'text-gray-500 hover:text-black'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setParam('called', 'CALLED')}
            className={`py-1.5 px-4 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              calledFilter === 'CALLED' 
                ? 'bg-black text-white shadow-sm' 
                : 'text-gray-500 hover:text-black'
            }`}
          >
            Called
          </button>
        </div>
      </div>
    </div>

      {/* Filters grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
        <Input 
          placeholder="Search name or contact..." 
          defaultValue={q} 
          onBlur={e => setParam('q', e.target.value.trim())}
          onKeyDown={e => { if (e.key === 'Enter') setParam('q', e.currentTarget.value.trim()) }}
        />
        <Select value={statusFilter} onChange={e => setParam('status', e.target.value)}>
          <option value="ALL">All Statuses</option>
          <option value="NEW">New</option>
          <option value="HOT">Hot</option>
          <option value="WARM">Warm</option>
          <option value="COLD">Cold</option>
          <option value="NOT_INTERESTED">Not Interested</option>
          <option value="CONVERTED">Converted</option>
          <option value="NOT_RECEIVED">Not Received</option>
        </Select>
        <Select value={assigneeFilter} onChange={e => setParam('assignee', e.target.value)}>
          <option value="ALL">All Assignees</option>
          <option value="UNASSIGNED">Unassigned</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
        </Select>
        <Select value={websiteFilter} onChange={e => setParam('website', e.target.value)}>
          <option value="ALL">Website: All</option>
          <option value="YES">Website: Yes</option>
          <option value="NO">Website: No</option>
        </Select>
        <Select value={firstInterestFilter} onChange={e => setParam('firstInterest', e.target.value)}>
          <option value="ALL">Interest: All</option>
          <option value="HAS">Has Interest</option>
          <option value="NONE">No Interest</option>
        </Select>
        <Select value={followupStateFilter} onChange={e => setParam('followupState', e.target.value)}>
          <option value="ALL">Follow-ups: All</option>
          <option value="SCHEDULED">Has Scheduled</option>
          <option value="OVERDUE">Overdue</option>
          <option value="NONE">None Set</option>
        </Select>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => router.push(pathname + '?assignee=' + assigneeFilter + '&called=' + calledFilter)}
          >
            Clear
          </Button>
          <Button variant="outline" className="flex items-center whitespace-nowrap px-3" onClick={() => setExportDialogOpen(true)}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-gray-50 border border-gray-200 p-3 rounded-md flex items-center justify-between">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setBulkAssignOpen(true)}>Assign</Button>
            <Button variant="outline" size="sm" onClick={() => { setTargetDeleteId(null); setDeleteConfirmOpen(true); }} className="text-red-600 hover:bg-red-50 hover:text-red-700">Delete</Button>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block border border-gray-200 rounded-lg overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs sticky top-0">
            <tr>
              <th className="px-4 py-3 font-medium w-[32px]">
                <Checkbox 
                  checked={data.rows.length > 0 && selectedIds.size === data.rows.length}
                  onChange={toggleSelectAll}
                />
              </th>
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
              <th className="px-4 py-3 font-medium">Assigned To</th>
              <th className="px-4 py-3 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={14} className="px-4 py-12 text-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading...
                </td>
              </tr>
            ) : data.rows.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-4 py-12 text-center text-gray-500">
                  No leads found.
                </td>
              </tr>
            ) : (
              groupLeadsByCsv(data.rows).map(group => (
                <React.Fragment key={group.csvName}>
                  {/* Sticky Group Header Row */}
                  <tr className="sticky top-[37px] z-10">
                    <td colSpan={14} className="bg-gray-50/95 backdrop-blur-sm border-y border-gray-200/80 py-2 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600 font-mono text-left">
                      📁 {group.csvName}
                    </td>
                  </tr>
                  {group.rows.map(row => {
                    const isChanged = changedRowIds.has(row.id)
                    return (
                      <tr key={row.id} className={`transition-colors duration-1000 ${isChanged ? 'bg-green-50' : 'hover:bg-gray-50'} group border-b border-gray-100`}>
                        <td className="px-4 py-2 align-top">
                          <div className="mt-1">
                            <Checkbox 
                              checked={selectedIds.has(row.id)}
                              onChange={() => toggleSelect(row.id)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2 align-top font-medium text-black">
                          <button onClick={() => setSelectedLeadIdForDrawer(row.id)} className="hover:underline text-left text-black font-semibold">
                            {row.name}
                          </button>
                        </td>
                        <td className="px-4 py-2 align-top text-gray-600 whitespace-nowrap">
                          {row.contact.includes('@') ? (
                            <a href={`mailto:${row.contact}`} className="hover:underline hover:text-black">{row.contact}</a>
                          ) : (
                            <a href={`tel:${row.contact}`} className="hover:underline hover:text-black">{row.contact}</a>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top">
                          {row.hasWebsite ? <span className="text-xs bg-gray-100 px-2 py-1 rounded">Yes</span> : <span className="text-xs text-gray-400">No</span>}
                        </td>
                        <td className="px-4 py-2 align-top">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="px-4 py-2 align-top text-gray-900 max-w-[150px] truncate text-sm">
                          {row.firstInterest ? (
                            <span title={row.firstInterest}>
                              {row.firstInterest}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top">
                          {!row.contact.includes('@') && (
                            <WhatsAppButton lead={row} bdName={row.assignedTo?.displayName || 'Admin'} />
                          )}
                        </td>
                        <td className="px-4 py-2 align-top">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={`h-8 text-xs whitespace-nowrap ${row.meetingsCount > 0 ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800' : ''}`}
                            onClick={() => setMeetingDrawerLeadId(row.id)}
                          >
                            {row.meetingsCount > 0 ? 'Meeting Set ✓' : 'Set Meeting'}
                          </Button>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs relative whitespace-nowrap"
                            onClick={() => setSelectedFollowUpsLeadId(row.id)}
                          >
                            Follow-ups ({row.activeFollowUps || 0}/4)
                          </Button>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs whitespace-nowrap flex items-center gap-1.5 text-gray-700 hover:text-black hover:border-gray-400"
                            onClick={() => setTimelineLeadId(row.id)}
                            title="View lead activity timeline"
                          >
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            Timeline
                          </Button>
                        </td>
                        <td className="px-4 py-2 align-top text-right text-gray-500 font-mono">
                          {row.callCount}
                        </td>
                        <td suppressHydrationWarning className="px-4 py-2 align-top text-right text-gray-500 whitespace-nowrap">
                          {formatRelativeTime(row.lastCalledAt)}
                        </td>
                        <td className="px-4 py-2 align-top">
                          <Select 
                            className="h-8 py-1 px-2 w-full max-w-[140px] text-xs"
                            value={row.assignedToId || ''}
                            onChange={(e) => handleSingleReassign(row.id, e.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                          </Select>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <div className="relative group/menu">
                            <button className="p-1 text-gray-400 hover:text-black rounded">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 hidden group-hover/menu:block bg-white border border-gray-200 shadow-lg rounded-md z-10 min-w-[140px] py-1">
                              <button 
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                onClick={() => setTimelineLeadId(row.id)}
                              >
                                <Clock className="w-3.5 h-3.5 text-gray-500" />
                                View Timeline
                              </button>
                              <button 
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => {
                                  setSelectedIds(new Set([row.id]))
                                  setBulkAssignOpen(true)
                                }}
                              >
                                Reassign
                              </button>
                              <button 
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                onClick={() => { 
                                  setTargetDeleteId(row.id)
                                  setDeleteConfirmOpen(true)
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
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
            Loading...
          </div>
        ) : data.rows.length === 0 ? (
          <div className="py-12 text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
            No leads found.
          </div>
        ) : (
          groupLeadsByCsv(data.rows).map(group => (
            <div key={group.csvName} className="space-y-4">
              {/* Sticky Group Header */}
              <div className="sticky top-0 z-10 -mx-4 px-4 bg-gray-50/95 backdrop-blur-sm border-y border-gray-200/80 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600 font-mono shadow-sm flex items-center gap-2">
                📁 {group.csvName}
              </div>
              {group.rows.map(row => {
                const isChanged = changedRowIds.has(row.id)
                return (
                  <div key={row.id} className={`bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-3 transition-colors duration-1000 ${isChanged ? 'bg-green-50' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className="mt-1">
                          <Checkbox 
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelect(row.id)}
                          />
                        </div>
                        <div>
                          <button onClick={() => setSelectedLeadIdForDrawer(row.id)} className="hover:underline text-left text-black font-semibold">
                            {row.name}
                          </button>
                          <div className="text-gray-600 text-sm mt-0.5">
                            {row.contact.includes('@') ? (
                              <a href={`mailto:${row.contact}`} className="hover:underline hover:text-black">{row.contact}</a>
                            ) : (
                              <a href={`tel:${row.contact}`} className="hover:underline hover:text-black">{row.contact}</a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="relative group/menu">
                        <button className="p-1 text-gray-400 hover:text-black rounded">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 hidden group-hover/menu:block bg-white border border-gray-200 shadow-lg rounded-md z-10 min-w-[140px] py-1">
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            onClick={() => setTimelineLeadId(row.id)}
                          >
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            View Timeline
                          </button>
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => {
                              setSelectedIds(new Set([row.id]))
                              setBulkAssignOpen(true)
                            }}
                          >
                            Reassign
                          </button>
                          <button 
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            onClick={() => { 
                              setTargetDeleteId(row.id)
                              setDeleteConfirmOpen(true)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs block mb-1">Status</span>
                        <StatusPill status={row.status} />
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block mb-1">Assigned To</span>
                        <Select 
                          className="h-8 py-1 px-2 w-full text-xs"
                          value={row.assignedToId || ''}
                          onChange={(e) => handleSingleReassign(row.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <div>
                        <span className="text-gray-500 text-xs block mb-1">Website</span>
                        {row.hasWebsite ? <span className="text-xs bg-gray-100 px-2 py-1 rounded">Yes</span> : <span className="text-xs text-gray-400">No</span>}
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 text-xs block mb-1">First Interest</span>
                        {row.firstInterest ? (
                          <span className="text-gray-900 truncate max-w-[120px] inline-block align-bottom" title={row.firstInterest}>{row.firstInterest}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 mt-2 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {!row.contact.includes('@') && (
                          <WhatsAppButton lead={row} bdName={row.assignedTo?.displayName || 'Admin'} className="flex-1 min-w-[120px] h-8 text-xs" />
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`flex-1 min-w-[120px] h-8 text-xs ${row.meetingsCount > 0 ? 'bg-green-50 text-green-700 border-green-200' : ''}`}
                          onClick={() => setMeetingDrawerLeadId(row.id)}
                        >
                          {row.meetingsCount > 0 ? 'Meeting Set ✓' : 'Set Meeting'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 min-w-[120px] h-8 text-xs"
                          onClick={() => setSelectedFollowUpsLeadId(row.id)}
                        >
                          Follow-ups ({row.activeFollowUps || 0}/4)
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 min-w-[120px] h-8 text-xs flex items-center justify-center gap-1 text-gray-700 hover:text-black"
                          onClick={() => setTimelineLeadId(row.id)}
                        >
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          Timeline
                        </Button>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-xs text-gray-500">
                        <div>Calls: <span className="font-mono text-gray-700">{row.callCount}</span></div>
                        <div suppressHydrationWarning>Last called: {formatRelativeTime(row.lastCalledAt)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div>
            Showing {(page - 1) * data.pageSize + 1} to {Math.min(page * data.pageSize, data.total)} of {data.total}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setParam('page', (page - 1).toString())}>Prev</Button>
            <Button variant="secondary" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setParam('page', (page + 1).toString())}>Next</Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog isOpen={bulkAssignOpen} onClose={() => setBulkAssignOpen(false)} title="Bulk Reassign Leads">
        <div className="space-y-4">
          <label className="text-sm font-medium">Assign {selectedIds.size} leads to:</label>
          <Select value={bulkAssignTo} onChange={e => setBulkAssignTo(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
          </Select>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkReassign}>Confirm Assignment</Button>
          </div>
        </div>
      </Dialog>

      <Dialog isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Confirm Deletion">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Are you sure you want to delete {targetDeleteId === null ? `${selectedIds.size} leads` : 'this lead'}? This action cannot be undone.
          </p>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Dialog>

      <LeadDetailDrawer 
        leadId={selectedLeadIdForDrawer} 
        onClose={() => setSelectedLeadIdForDrawer(null)}
        onReassign={() => { 
          setBulkAssignOpen(true)
          setSelectedIds(new Set([selectedLeadIdForDrawer!]))
        }}
        onDelete={() => {
          setTargetDeleteId(selectedLeadIdForDrawer)
          setSelectedLeadIdForDrawer(null)
          setDeleteConfirmOpen(true)
        }}
      />

      {selectedFollowUpsLeadId && (
        <AdminFollowUpsDrawer
          leadId={selectedFollowUpsLeadId}
          leadName={data.rows.find(r => r.id === selectedFollowUpsLeadId)?.name || 'Lead'}
          onClose={() => setSelectedFollowUpsLeadId(null)}
        />
      )}

      {meetingDrawerLeadId && (
        <MeetingDrawer 
          leadId={meetingDrawerLeadId}
          leadName={data.rows.find(l => l.id === meetingDrawerLeadId)?.name || 'Lead'}
          onClose={() => {
            setMeetingDrawerLeadId(null)
            fetchLeads() // refresh to update meetingsCount if changed
          }}
        />
      )}

      {timelineLeadId && (
        <LeadTimelineDrawer 
          leadId={timelineLeadId}
          leadName={data.rows.find(l => l.id === timelineLeadId)?.name || 'Lead'}
          onClose={() => setTimelineLeadId(null)}
        />
      )}

      {/* Export Dialog */}
      <ExportLeadsDialog 
        open={exportDialogOpen} 
        onClose={() => setExportDialogOpen(false)} 
        scope="admin"
        currentFilters={Object.fromEntries(searchParams.entries())}
      />

      {/* Add Single Lead Dialog */}
      <AddLeadDialog 
        open={addLeadOpen} 
        onClose={() => setAddLeadOpen(false)} 
        users={users}
        defaultAssigneeId={assigneeFilter}
        onLeadCreated={() => {
          fetchLeads()
          router.refresh()
        }}
      />
    </div>
  )
}

export function LeadsClient(props: Parameters<typeof LeadsClientInner>[0]) {
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading leads...</div>}>
      <LeadsClientInner {...props} />
    </Suspense>
  )
}
