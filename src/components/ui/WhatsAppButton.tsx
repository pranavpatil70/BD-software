'use client'

import * as React from 'react'
import { MessageCircle, Loader2, Check } from 'lucide-react'
import { Button } from './Button'
import { toast } from 'sonner'
import { toWhatsAppUrl } from '@/lib/phone'

interface WhatsAppButtonProps {
  lead: {
    id: string
    name: string
    contact: string
    whatsappSentAt?: string | null
  }
  bdName: string
  className?: string
}

export function WhatsAppButton({ lead, bdName, className }: WhatsAppButtonProps) {
  const [status, setStatus] = React.useState<'default' | 'sending' | 'sent'>(
    lead.whatsappSentAt ? 'sent' : 'default'
  )

  // Sync state if lead changes
  React.useEffect(() => {
    setStatus(lead.whatsappSentAt ? 'sent' : 'default')
  }, [lead.whatsappSentAt])

  const handleSend = async () => {
    setStatus('sending')
    try {
      // Log to backend
      const res = await fetch(`/api/leads/${lead.id}/whatsapp`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Failed to log WhatsApp message')

      // Generate template
      const template = `Hi ${lead.name},

This is ${bdName} from Intellobyte. Thank you for showing interest in our services during our recent conversation — I wanted to follow up here on WhatsApp so it's easier for us to stay in touch.

At Intellobyte, we help businesses build fast, modern, and scalable web solutions — from custom websites and web apps to complete digital products tailored to your goals.

Whenever you're ready, I'd love to walk you through how we can support your project and share a few relevant examples of our work.

You can also learn more about us here: https://www.intellobyte.com

Looking forward to connecting!

Best regards,
${bdName}
Intellobyte`

      const url = toWhatsAppUrl(lead.contact, template)
      
      // Open WhatsApp
      window.open(url, '_blank')
      
      setStatus('sent')
    } catch (err) {
      toast.error('Failed to send WhatsApp message')
      setStatus('default')
    }
  }

  return (
    <Button 
      size="sm" 
      variant="outline"
      disabled={status === 'sending'}
      onClick={handleSend}
      className={`text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 ${className || ''}`}
    >
      {status === 'sending' && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
      {status === 'sent' && <Check className="w-3 h-3 mr-2" />}
      {status === 'default' && <MessageCircle className="w-3 h-3 mr-2" />}
      
      {status === 'sending' && 'Opening...'}
      {status === 'sent' && 'Sent'}
      {status === 'default' && 'WhatsApp'}
    </Button>
  )
}
