'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface CompletedUser {
  id: string
  displayName: string
  _count: {
    leads: number
  }
}

export function AdminNotificationSystem() {
  const [completedUsers, setCompletedUsers] = useState<CompletedUser[]>([])
  const [dismissedUserIds, setDismissedUserIds] = useState<Set<string>>(new Set())
  const [showPopup, setShowPopup] = useState(false)
  const router = useRouter()

  const fetchCompletedUsers = async () => {
    try {
      const res = await fetch('/api/admin/users/calling-done')
      if (!res.ok) throw new Error('Failed to fetch status')
      const data: CompletedUser[] = await res.json()
      
      // Filter out users who have been dismissed in this session
      const activeAlerts = data.filter(user => !dismissedUserIds.has(user.id))
      setCompletedUsers(activeAlerts)
      
      if (activeAlerts.length > 0) {
        setShowPopup(true)
      } else {
        setShowPopup(false)
      }
    } catch (err) {
      console.error('Error fetching completed users:', err)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchCompletedUsers()

    // Poll every 45 seconds
    const interval = setInterval(fetchCompletedUsers, 45000)
    return () => clearInterval(interval)
  }, [dismissedUserIds])

  const handleDismissUser = (userId: string) => {
    setDismissedUserIds(prev => {
      const updated = new Set(prev)
      updated.add(userId)
      return updated
    })
    setCompletedUsers(prev => prev.filter(u => u.id !== userId))
  }

  const handleAssignMore = () => {
    setShowPopup(false)
    router.push('/admin/upload')
  }

  if (!showPopup || completedUsers.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white border border-black shadow-2xl rounded-lg p-5 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-black text-white rounded-full">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-black text-sm">Leads Completed!</h4>
            <p className="text-xs text-gray-500 mt-0.5">BD executives have finished calling.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowPopup(false)}
          className="text-gray-400 hover:text-black transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="max-h-32 overflow-y-auto divide-y divide-gray-100 pr-1">
          {completedUsers.map(user => (
            <div key={user.id} className="flex justify-between items-center py-2 text-xs">
              <span className="font-medium text-gray-800">{user.displayName}</span>
              <div className="flex items-center gap-2">
                <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] text-gray-600 font-mono">
                  {user._count.leads} leads done
                </span>
                <button
                  onClick={() => handleDismissUser(user.id)}
                  className="text-gray-400 hover:text-red-500 text-[10px] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <Button 
            variant="default" 
            size="sm" 
            className="flex-1 text-xs py-2 bg-black text-white hover:bg-gray-800"
            onClick={handleAssignMore}
          >
            Assign More Leads
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs py-2"
            onClick={() => setShowPopup(false)}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
