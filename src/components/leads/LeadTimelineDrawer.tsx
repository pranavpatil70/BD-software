'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { StatusPill } from '@/components/ui/StatusPill'
import { 
  Phone, 
  Calendar, 
  Clock, 
  Tag, 
  MessageCircle, 
  UserCheck, 
  Sparkles, 
  Loader2, 
  Copy, 
  Check, 
  User, 
  AlertCircle,
  FileText
} from 'lucide-react'

interface TimelineEvent {
  id: string
  type: 'CALL' | 'STATUS_CHANGE' | 'FOLLOWUP' | 'MEETING' | 'WHATSAPP' | 'REASSIGNED' | 'CREATION'
  timestamp: string
  title: string
  description: string | null
  actor: { id?: string; displayName: string } | null
  metadata: Record<string, any> | null
}

interface TimelineData {
  lead: {
    id: string
    name: string
    contact: string
    hasWebsite: boolean
    status: string
    firstInterest: string | null
    customFields?: string | null
    callCount: number
    lastCalledAt: string | null
    whatsappSentAt: string | null
    createdAt: string
    assignedTo: { id: string; displayName: string } | null
  }
  events: TimelineEvent[]
  summary: {
    totalCalls: number
    totalMeetings: number
    totalFollowUps: number
    currentStatus: string
  }
}

interface LeadTimelineDrawerProps {
  leadId: string | null
  leadName?: string
  onClose: () => void
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60000) return 'Just now'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function getEventIcon(type: TimelineEvent['type']) {
  switch (type) {
    case 'CALL':
      return <Phone className="w-4 h-4 text-blue-600" />
    case 'MEETING':
      return <Calendar className="w-4 h-4 text-emerald-600" />
    case 'FOLLOWUP':
      return <Clock className="w-4 h-4 text-purple-600" />
    case 'STATUS_CHANGE':
      return <Tag className="w-4 h-4 text-amber-600" />
    case 'WHATSAPP':
      return <MessageCircle className="w-4 h-4 text-green-600" />
    case 'REASSIGNED':
      return <UserCheck className="w-4 h-4 text-indigo-600" />
    case 'CREATION':
    default:
      return <Sparkles className="w-4 h-4 text-gray-600" />
  }
}

function getEventBadgeColor(type: TimelineEvent['type']) {
  switch (type) {
    case 'CALL':
      return 'bg-blue-50 border-blue-200'
    case 'MEETING':
      return 'bg-emerald-50 border-emerald-200'
    case 'FOLLOWUP':
      return 'bg-purple-50 border-purple-200'
    case 'STATUS_CHANGE':
      return 'bg-amber-50 border-amber-200'
    case 'WHATSAPP':
      return 'bg-green-50 border-green-200'
    case 'REASSIGNED':
      return 'bg-indigo-50 border-indigo-200'
    case 'CREATION':
    default:
      return 'bg-gray-100 border-gray-200'
  }
}

export function LeadTimelineDrawer({ leadId, leadName, onClose }: LeadTimelineDrawerProps) {
  const [data, setData] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!leadId) {
      setData(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    fetch(`/api/leads/${leadId}/timeline`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to load timeline')
        }
        return res.json()
      })
      .then((json: TimelineData) => {
        if (isMounted) {
          setData(json)
          setLoading(false)
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Something went wrong')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [leadId])

  const handleCopyContact = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Drawer 
      open={!!leadId} 
      onClose={onClose}
      widthClassName="max-w-lg"
      title={
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-black" />
          <span>Activity Timeline</span>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-black" />
            <p className="text-sm">Loading activity history...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Failed to load timeline</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loaded Content */}
        {!loading && data && (
          <>
            {/* Lead Summary Header Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{data.lead.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-gray-600">{data.lead.contact}</span>
                    <button
                      onClick={() => handleCopyContact(data.lead.contact)}
                      className="text-gray-400 hover:text-black transition-colors"
                      title="Copy contact"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <StatusPill status={data.lead.status} />
              </div>

              {/* Assignee & Meta */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200/60 text-xs text-gray-500">
                <span className="flex items-center gap-1 font-medium text-gray-700">
                  <User className="w-3.5 h-3.5" />
                  {data.lead.assignedTo?.displayName || 'Unassigned'}
                </span>
                {data.lead.firstInterest && (
                  <span className="flex items-center gap-1 truncate max-w-[200px]" title={data.lead.firstInterest}>
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {data.lead.firstInterest}
                  </span>
                )}
              </div>

              
              {(() => {
                let cf = {}
                if (data.lead.customFields) {
                  try { cf = JSON.parse(data.lead.customFields) } catch {}
                }
                if (!cf || Object.keys(cf).length === 0) return null
                return (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-200/60">
                    {Object.entries(cf).map(([k, v]) => (
                      <span key={k} className="inline-flex items-center gap-1 text-[11px] bg-white text-gray-800 px-2.5 py-1 rounded-md border border-gray-200 shadow-2xs font-medium">
                        <span className="text-gray-500">{k}:</span>
                        <span className="font-semibold text-gray-900">{String(v)}</span>
                      </span>
                    ))}
                  </div>
                )
              })()}

              {/* Metric Counters */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200/60 text-center">
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <div className="text-base font-bold text-gray-900">{data.summary.totalCalls}</div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Calls</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <div className="text-base font-bold text-gray-900">{data.summary.totalFollowUps}</div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Follow-Ups</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <div className="text-base font-bold text-gray-900">{data.summary.totalMeetings}</div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Meetings</div>
                </div>
              </div>
            </div>

            {/* Vertical Chronological Timeline Feed */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                Timeline Events ({data.events.length})
              </h4>

              {data.events.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  No activity events recorded yet.
                </div>
              ) : (
                <div className="relative pl-6 pt-3 space-y-6 before:absolute before:left-[11px] before:top-4 before:bottom-2 before:w-[2px] before:bg-gray-200">
                  {data.events.map((event) => (
                    <div key={event.id} className="relative group">
                      {/* Node Dot / Icon */}
                      <div className={`absolute -left-6 top-0 w-6 h-6 rounded-full border flex items-center justify-center shadow-xs ${getEventBadgeColor(event.type)}`}>
                        {getEventIcon(event.type)}
                      </div>

                      {/* Event Content */}
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h5 className="text-xs font-semibold text-gray-900 leading-snug">
                            {event.title}
                          </h5>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0" title={formatDateTime(event.timestamp)}>
                            {formatRelativeTime(event.timestamp)}
                          </span>
                        </div>

                        {/* Description / Notes Card */}
                        {event.description && (
                          <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-2.5 text-xs text-gray-700 leading-relaxed font-sans">
                            {event.description}
                          </div>
                        )}

                        {/* Meeting Metadata Badge */}
                        {event.type === 'MEETING' && event.metadata?.scheduledAt && (
                          <div className="text-[11px] text-emerald-700 bg-emerald-50/70 border border-emerald-200/60 rounded px-2 py-0.5 inline-block">
                            Scheduled for: {formatDateTime(String(event.metadata.scheduledAt))}
                          </div>
                        )}

                        {/* Follow-up Metadata Badge */}
                        {event.type === 'FOLLOWUP' && event.metadata?.scheduledAt && (
                          <div className="text-[11px] text-purple-700 bg-purple-50/70 border border-purple-200/60 rounded px-2 py-0.5 inline-block">
                            Due: {formatDateTime(String(event.metadata.scheduledAt))}
                          </div>
                        )}

                        {/* Actor / Timestamp sub-line */}
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span>{formatDateTime(event.timestamp)}</span>
                          {event.actor && (
                            <>
                              <span>•</span>
                              <span>By {event.actor.displayName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}
