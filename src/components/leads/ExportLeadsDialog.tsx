'use client'

import React, { useState, useEffect } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ExportLeadsDialogProps {
  open: boolean
  onClose: () => void
  scope?: 'user' | 'admin'
  currentFilters?: Record<string, string>
}

const ALL_STATUSES = ['NEW', 'HOT', 'WARM', 'COLD', 'NOT_INTERESTED', 'CONVERTED', 'NOT_RECEIVED']

export function ExportLeadsDialog({ open, onClose, currentFilters }: ExportLeadsDialogProps) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['HOT', 'WARM', 'CONVERTED']))
  const [count, setCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Fetch count whenever selectedStatuses or open changes
  useEffect(() => {
    if (!open) return

    const fetchCount = async () => {
      setLoadingCount(true)
      try {
        const params = new URLSearchParams()
        if (currentFilters) {
          Object.entries(currentFilters).forEach(([k, v]) => params.append(k, v))
        }
        params.set('statuses', Array.from(selectedStatuses).join(','))
        params.set('count', 'true')
        params.delete('page') // count query doesn't need page

        const endpoint = '/api/admin/leads/export'
        const res = await fetch(`${endpoint}?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch count')
        const data = await res.json()
        setCount(data.count)
      } catch (err) {
        console.error('Count error', err)
        setCount(0)
      } finally {
        setLoadingCount(false)
      }
    }

    fetchCount()
  }, [open, selectedStatuses, currentFilters])

  const toggleStatus = (status: string) => {
    const newSet = new Set(selectedStatuses)
    if (newSet.has(status)) {
      newSet.delete(status)
    } else {
      newSet.add(status)
    }
    setSelectedStatuses(newSet)
  }

  const handleExport = async () => {
    if (selectedStatuses.size === 0) {
      toast.error('Please select at least one status to export')
      return
    }

    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      if (currentFilters) {
        Object.entries(currentFilters).forEach(([k, v]) => params.append(k, v))
      }
      params.set('statuses', Array.from(selectedStatuses).join(','))
      params.delete('page')

      const endpoint = '/api/admin/leads/export'
      const exportUrl = `${endpoint}?${params.toString()}`

      // Create a temporary link to trigger download
      const a = document.createElement('a')
      a.href = exportUrl
      a.download = '' // The server should provide the filename via Content-Disposition
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      toast.success('Export started')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const filterSummary = () => {
    if (!currentFilters) return null
    const entries = Object.entries(currentFilters).filter(([k, v]) => v && v !== 'ALL' && k !== 'page' && k !== 'status')
    if (entries.length === 0) return null

    return (
      <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded border border-gray-200">
        <span className="font-medium text-gray-700">Applied filters:</span>{' '}
        {entries.map(([k, v]) => `${k}=${v}`).join(', ')}
        {' '} <span className="italic">(applied from page filters)</span>
      </div>
    )
  }

  return (
    <Dialog isOpen={open} onClose={onClose} title="Export Interested Leads">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Export interested leads matching the current filters to CSV.
        </p>

        {filterSummary()}

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Include Statuses</label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_STATUSES.map(status => (
              <label key={status} className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                <Checkbox 
                  checked={selectedStatuses.has(status)}
                  onChange={() => toggleStatus(status)}
                />
                <span>{status}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-2 text-sm font-medium text-gray-900 flex items-center h-6">
          {loadingCount ? (
            <span className="flex items-center text-gray-500"><Loader2 className="w-3 h-3 animate-spin mr-2" /> Calculating...</span>
          ) : count !== null ? (
            `${count} leads will be exported`
          ) : null}
        </div>

        <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={isExporting || count === 0 || selectedStatuses.size === 0}
            className="flex items-center"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Download CSV
          </Button>
        </div>
        
        {count === 0 && !loadingCount && (
          <p className="text-xs text-red-500 text-right mt-1">
            No leads match — adjust filters or status selection.
          </p>
        )}
      </div>
    </Dialog>
  )
}
