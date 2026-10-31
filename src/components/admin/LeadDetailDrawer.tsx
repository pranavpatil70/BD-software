'use client'

import { useState, useEffect } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

interface LeadDetailData {
  lead: {
    id: string
    name: string
    contact: string
    hasWebsite: boolean
    status: string
    firstInterest: string | null
    customFields?: string | null
    createdAt: string
    updatedAt: string
    assignedTo: { displayName: string } | null
  }
  followUps: Array<{ slot: number, scheduledAt: string | null, note: string | null, completed: boolean } | null>
  calls: Array<{ id: string, calledAt: string, notes: string | null, user: { displayName: string } }>
  statusChanges: Array<{ createdAt: string, metadata: string | null, user: { displayName: string } }>
}

function formatRelativeTime(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60000) return 'just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function LeadDetailDrawer({ 
  leadId, 
  onClose,
  onReassign,
  onDelete
}: { 
  leadId: string | null
  onClose: () => void
  onReassign: () => void
  onDelete: () => void
}) {
  const [data, setData] = useState<LeadDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchDetail = async () => {
    if (!leadId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/detail`)
      if (!res.ok) throw new Error('Failed to load lead details')
      const json = await res.json()
      setData(json)
      setLastFetched(new Date())
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (leadId) {
      // eslint-disable-next-line
      setData(null)
      fetchDetail()
    }
    // eslint-disable-next-line
  }, [leadId])

  if (!leadId) return null

  return (
    <Drawer open={!!leadId} onClose={onClose} widthClassName="max-w-xl">
      <div className="flex flex-col h-full">
        {loading && !data && (
          <div className="p-8 text-center text-gray-500">Loading lead details...</div>
        )}
        
        {error && (
          <div className="p-8 text-center text-red-500">{error}</div>
        )}

        {data && (
          <div className="flex-1 overflow-y-auto">
            {/* Refresh Banner */}
            {lastFetched && (
              <div className="bg-gray-50 px-6 py-2 text-xs text-gray-500 border-b border-gray-100 flex justify-between items-center">
                <span>Updated {formatRelativeTime(lastFetched)}</span>
                <button onClick={fetchDetail} className="hover:underline text-black font-medium">Refresh</button>
              </div>
            )}

            {/* Header */}
            <div className="px-6 py-6 border-b border-gray-100 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">{data.lead.name}</h1>
                  <p className="text-gray-500 mt-1">{data.lead.contact}</p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-black">✕</button>
              </div>
              
              <div className="flex flex-wrap gap-2 items-center">
                <StatusPill status={data.lead.status} />
                {data.lead.hasWebsite && (
                  <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-gray-200">
                    Website
                  </span>
                )}
                <span className="text-sm text-gray-600 ml-2">
                  Assigned to: <span className="font-medium text-gray-900">{data.lead.assignedTo?.displayName || 'Unassigned'}</span>
                </span>
                <button onClick={onReassign} className="text-xs font-medium underline text-gray-500 hover:text-black ml-1">
                  Change
                </button>
              </div>

              <div className="text-xs text-gray-400 pt-2 border-t border-gray-50 flex gap-4">
                <span>Created {new Date(data.lead.createdAt).toLocaleDateString()}</span>
                <span>Last updated {formatRelativeTime(data.lead.updatedAt)}</span>
              </div>
            </div>

            {/* First Interest */}
            <div className="px-6 py-6 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">First Interest</h3>
              {data.lead.firstInterest ? (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-800 whitespace-pre-wrap">
                  {data.lead.firstInterest}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Not yet captured</p>
              )}
            </div>

            
            {/* Custom Fields */}
            {(() => {
              let cf = {}
              if (data.lead.customFields) {
                try { cf = JSON.parse(data.lead.customFields) } catch {}
              }
              if (!cf || Object.keys(cf).length === 0) return null
              return (
                <div className="px-6 py-6 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Custom Fields</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(cf).map(([k, v]) => (
                      <div key={k} className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm">
                        <span className="text-gray-500 font-medium">{k}: </span>
                        <span className="font-semibold text-gray-900">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Follow-ups */}
            <div className="px-6 py-6 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Follow-ups</h3>
              <div className="space-y-3">
                {data.followUps.map((fu, idx) => {
                  const slot = idx + 1
                  if (!fu) {
                    return (
                      <div key={slot} className="border border-gray-100 bg-gray-50 rounded-md p-3 opacity-60">
                        <h4 className="text-xs font-medium text-gray-500 mb-1">Follow-up {slot}</h4>
                        <p className="text-sm text-gray-400">Not scheduled</p>
                      </div>
                    )
                  }
                  
                  const isOverdue = !fu.completed && fu.scheduledAt && new Date(fu.scheduledAt) <= new Date()
                  
                  return (
                    <div key={slot} className={`border rounded-md p-4 ${fu.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-gray-300 shadow-sm'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          Follow-up {slot}
                          {isOverdue && <span className="bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Overdue</span>}
                        </h4>
                        <span className={`text-xs font-medium ${fu.completed ? 'text-gray-900' : 'text-gray-400'}`}>
                          {fu.completed ? '✓ Completed' : 'Pending'}
                        </span>
                      </div>
                      
                      {fu.scheduledAt && (
                        <p className={`text-sm mb-2 ${isOverdue ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                          {new Date(fu.scheduledAt).toLocaleDateString()} · {isOverdue ? 'was due ' : ''}{formatRelativeTime(fu.scheduledAt)}
                        </p>
                      )}
                      
                      {fu.note ? (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-2 rounded border border-gray-100">{fu.note}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No notes</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Call History */}
            <div className="px-6 py-6 border-b border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Call History · {data.calls.length} calls</h3>
                {data.calls.length >= 20 && (
                  <Link href={`/admin/activity?leadId=${data.lead.id}`} className="text-xs underline text-gray-500 hover:text-black">
                    View all logs
                  </Link>
                )}
              </div>
              
              {data.calls.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No calls logged yet</p>
              ) : (
                <div className="space-y-4">
                  {data.calls.map((call) => (
                    <div key={call.id} className="relative pl-4 border-l-2 border-gray-200">
                      <div className="absolute w-2 h-2 bg-gray-300 rounded-full -left-[5px] top-1.5" />
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-900" title={new Date(call.calledAt).toLocaleString()}>{formatRelativeTime(call.calledAt)}</span>
                        <span className="text-xs text-gray-500">by {call.user.displayName}</span>
                      </div>
                      <p className="text-sm text-gray-700 italic">{call.notes || 'No notes'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status Timeline */}
            {data.statusChanges.length > 0 && (
              <div className="px-6 py-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Status Changes</h3>
                <div className="space-y-3">
                  {data.statusChanges.map((sc, idx) => {
                    let meta: Record<string, string> = {}
                    try { meta = JSON.parse(sc.metadata || '{}') } catch {}
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500 min-w-[60px]">{formatRelativeTime(sc.createdAt)}</span>
                        <span className="font-medium text-gray-900">{meta.from || 'NEW'} → {meta.to}</span>
                        <span className="text-gray-400 text-xs">by {sc.user.displayName}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
          <Button variant="outline" size="sm" onClick={onReassign}>
            Reassign Lead
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700">
            Delete Lead
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
