'use client'

import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface CompletedNotification {
  id: string
  userId: string
  displayName: string
  _count: {
    leads: number
  }
}

export function AdminBellNotification() {
  const [notifications, setNotifications] = useState<CompletedNotification[]>([])
  const [openedUserIds, setOpenedUserIds] = useState<Set<string>>(new Set())
  const [isOpen, setIsOpen] = useState(false)
  const [shouldShake, setShouldShake] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Fetch completed users notifications from the database (via calling-done endpoint)
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/users/calling-done')
      if (!res.ok) throw new Error('Failed to fetch status')
      const data: CompletedNotification[] = await res.json()
      
      setNotifications(data)

      if (data.length > 0) {
        // Detect if there are any new completed users that haven't been processed in the current session
        const newCompletions = data.filter(item => !openedUserIds.has(item.id))

        if (newCompletions.length > 0) {
          // Add these new IDs to the openedUserIds list
          setOpenedUserIds(prev => {
            const updated = new Set(prev)
            newCompletions.forEach(item => updated.add(item.id))
            return updated
          })

          // Do not auto-pop or shake on the very first load of the page,
          // but do show the red dot if there are unread entries
          if (isInitialLoad) {
            setHasUnread(true)
            setIsInitialLoad(false)
          } else {
            setIsOpen(true)
            setShouldShake(true)
            setHasUnread(true)
          }
        }
      } else {
        setIsInitialLoad(false)
      }
    } catch (err) {
      console.error('Error fetching completed users in bell:', err)
    }
  }

  // Poll for finished BDs every 45 seconds
  useEffect(() => {
    fetchNotifications()

    const interval = setInterval(fetchNotifications, 45000)
    return () => clearInterval(interval)
  }, [openedUserIds, isInitialLoad])

  // Handle shake animation reset
  useEffect(() => {
    if (shouldShake) {
      const timer = setTimeout(() => setShouldShake(false), 600)
      return () => clearTimeout(timer)
    }
  }, [shouldShake])

  // Handle clicking outside the dropdown container to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Clear unread badge when the admin explicitly views/toggles the dropdown
  const handleToggleOpen = () => {
    setIsOpen(prev => {
      const nextState = !prev
      if (nextState) {
        setHasUnread(false)
      }
      return nextState
    })
  }

  // Action: Route to assign leads and close popup
  const handleAssignMore = () => {
    setIsOpen(false)
    router.push('/admin/upload')
  }

  const activeAlertsCount = notifications.length

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Dynamic Keyframe Injection for Shake Animation */}
      <style>{`
        @keyframes bell-shake {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(12deg); }
          30% { transform: rotate(-12deg); }
          45% { transform: rotate(8deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(4deg); }
          90% { transform: rotate(-4deg); }
        }
        .animate-bell-shake {
          animation: bell-shake 0.6s ease-in-out;
          transform-origin: top center;
        }
      `}</style>

      {/* Bell Toggle Button */}
      <button
        onClick={handleToggleOpen}
        className="p-1.5 rounded-full hover:bg-gray-100 transition-colors relative focus:outline-none cursor-pointer"
        title="Admin Notifications"
      >
        <Bell 
          className={`w-5 h-5 text-gray-700 hover:text-black transition-colors ${
            shouldShake ? 'animate-bell-shake' : ''
          }`} 
        />
        
        {/* Pulsing Red Dot Badge on the Top-Right Corner (Unread only) */}
        {hasUnread && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-white border border-gray-200 shadow-2xl rounded-lg p-4 font-sans text-xs z-50 animate-in fade-in-50 slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-black"></span>
              <h4 className="font-semibold text-black text-sm">Leads Completed History</h4>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-black transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {activeAlertsCount === 0 ? (
            <div className="py-6 text-center text-gray-500">
              No recent alerts. Completed histories will appear here!
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-gray-500">History of the last 10 Business Development executives who completed calling all their leads.</p>
              
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 pr-1">
                {notifications.map(item => (
                  <div key={item.id} className="flex justify-between items-center py-2.5 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-gray-800">{item.displayName}</span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" /> Persistent Completed
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] text-gray-600 font-mono">
                        {item._count.leads} leads done
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Button 
                  variant="default" 
                  size="sm" 
                  className="flex-1 text-xs py-2 bg-black text-white hover:bg-gray-800 font-medium"
                  onClick={handleAssignMore}
                >
                  Assign More Leads
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs py-2 font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
