'use client'

import * as React from 'react'
import { useState, useMemo } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { cleanPhoneNumber } from '@/lib/phone'
import { toast } from 'sonner'
import { UserPlus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface AddLeadDialogProps {
  open: boolean
  onClose: () => void
  users: { id: string; displayName: string; username?: string }[]
  onLeadCreated?: (lead: any) => void
  defaultAssigneeId?: string | null
}

export function AddLeadDialog({
  open,
  onClose,
  users,
  onLeadCreated,
  defaultAssigneeId = null
}: AddLeadDialogProps) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [hasWebsite, setHasWebsite] = useState(false)
  const [assignedToId, setAssignedToId] = useState<string>(defaultAssigneeId || '')
  const [firstInterest, setFirstInterest] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync default assignee if changed
  React.useEffect(() => {
    if (defaultAssigneeId && defaultAssigneeId !== 'ALL' && defaultAssigneeId !== 'UNASSIGNED') {
      setAssignedToId(defaultAssigneeId)
    } else {
      setAssignedToId('')
    }
  }, [defaultAssigneeId, open])

  // Live phone validation preview
  const phoneValidation = useMemo(() => {
    if (!contact.trim()) return null
    return cleanPhoneNumber(contact)
  }, [contact])

  const handleReset = () => {
    setName('')
    setContact('')
    setHasWebsite(false)
    setAssignedToId(defaultAssigneeId && defaultAssigneeId !== 'ALL' && defaultAssigneeId !== 'UNASSIGNED' ? defaultAssigneeId : '')
    setFirstInterest('')
    setError(null)
    setLoading(false)
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please enter lead name')
      return
    }

    if (!phoneValidation?.isValid || !phoneValidation.cleaned) {
      setError(phoneValidation?.reason || 'Please enter a valid 10-digit mobile number')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          contact: phoneValidation.cleaned,
          hasWebsite,
          assignedToId: assignedToId || null,
          firstInterest: firstInterest.trim() || null,
          status: 'NEW'
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create lead')
      }

      toast.success(`Lead "${name.trim()}" added successfully!`)
      if (onLeadCreated) {
        onLeadCreated(data.lead)
      }
      handleClose()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog isOpen={open} onClose={handleClose} className="sm:max-w-[440px]">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Add Single Lead</h2>
          </div>
          <p className="text-xs text-gray-500">
            Create an individual lead with instant caller assignment and duplicate prevention.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Lead / Contact Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. Rajesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />
          </div>

          {/* Contact / Phone Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. 9876543210 or +91 98765 43210"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              disabled={loading}
              required
            />
            {phoneValidation && (
              <div className="mt-1.5 text-xs">
                {phoneValidation.isValid ? (
                  <span className="text-green-600 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Standardized: {phoneValidation.formatted}
                  </span>
                ) : (
                  <span className="text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {phoneValidation.reason}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Assign Executive */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Assign to Caller
            </label>
            <Select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              disabled={loading}
            >
              <option value="">Leave Unassigned (Inbox)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} {u.username ? `(@${u.username})` : ''}
                </option>
              ))}
            </Select>
          </div>

          {/* Website Toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Has Existing Website?
            </label>
            <Select
              value={hasWebsite ? 'YES' : 'NO'}
              onChange={(e) => setHasWebsite(e.target.value === 'YES')}
              disabled={loading}
            >
              <option value="NO">No (Cold Outreach Target)</option>
              <option value="YES">Yes</option>
            </Select>
          </div>

          {/* First Interest / Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Initial Interest / Note <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <Input
              placeholder="e.g. Inquired about pricing, needs 2BHK flat"
              value={firstInterest}
              onChange={(e) => setFirstInterest(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-black text-white hover:bg-gray-800"
            disabled={loading || !name.trim() || !phoneValidation?.isValid}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Lead...
              </>
            ) : (
              'Create Lead'
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
