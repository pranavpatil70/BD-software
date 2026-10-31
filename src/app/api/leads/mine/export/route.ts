import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  
  // S12 & R9: Restrict lead exports to Admins, prevent Callers from downloading
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Exports and report downloads are strictly restricted to Administrators (S12 / R9).' },
      { status: 403 }
    )
  }

  return NextResponse.json(
    { error: 'Callers cannot download reports or leads. Please use the Admin export portal at /admin/leads.' },
    { status: 403 }
  )
}

