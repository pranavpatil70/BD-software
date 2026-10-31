'use client'

import { useState, useEffect, useRef } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { formatActivity, type EnrichedActivityLog } from '@/lib/activity'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

function formatRelativeTime(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60000) return 'just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function LiveUpdatesFeed({ initialLogs }: { initialLogs: EnrichedActivityLog[] }) {
  const [logs, setLogs] = useState<EnrichedActivityLog[]>(initialLogs)
  const [newLogIds, setNewLogIds] = useState<Set<string>>(new Set())

  const latestDate = useRef(initialLogs.length > 0 ? initialLogs[0].createdAt : null)

  const fetcher = async () => {
    let url = '/api/admin/activity/recent'
    if (latestDate.current) {
      url += `?since=${new Date(latestDate.current).toISOString()}`
    }
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch')
    const data = await res.json()
    return data.logs as EnrichedActivityLog[]
  }

  const { data: newFetchedLogs } = usePolling(fetcher, 45000)

  useEffect(() => {
    if (newFetchedLogs && newFetchedLogs.length > 0) {
      // eslint-disable-next-line
      setLogs(prev => {
        const combined = [...newFetchedLogs, ...prev]
        // remove duplicates just in case
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values())
        return unique.slice(0, 30)
      })
      
      const ids = new Set(newFetchedLogs.map(l => l.id))
      setNewLogIds(ids)
      
      // Update latest date
      latestDate.current = newFetchedLogs[0].createdAt

      // Clear highlights after 2 seconds
      setTimeout(() => {
        setNewLogIds(new Set())
      }, 2000)
    }
  }, [newFetchedLogs])

  return (
    <Card className="flex flex-col h-full max-h-[600px]">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-lg">
        <h2 className="font-semibold">Live Updates</h2>
        <span className="flex items-center text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
          Live
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-0 min-h-[300px]">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No recent activity.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map(log => {
              const { text, icon: Icon } = formatActivity(log)
              const isNew = newLogIds.has(log.id)
              return (
                <div 
                  key={log.id} 
                  className={`p-4 flex items-start gap-3 transition-colors duration-1000 ${isNew ? 'bg-gray-100' : 'bg-white'}`}
                >
                  <div className="mt-0.5 p-1.5 bg-gray-50 rounded-md border border-gray-100">
                    <Icon className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{text}</p>
                    <p suppressHydrationWarning className="text-xs text-gray-500 mt-0.5">{formatRelativeTime(log.createdAt)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-lg text-center">
        <Link href="/admin/activity" className="text-sm font-medium hover:underline text-black">
          View all activity →
        </Link>
      </div>
    </Card>
  )
}
