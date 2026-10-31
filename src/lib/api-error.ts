import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}

export function handleApiError(err: unknown): NextResponse {
  // Rethrow Next.js internal errors (redirects, authInterrupts, notFound)
  if (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof (err as { digest: string }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_')
  ) {
    throw err
  }

  // ApiError — known/intentional
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, details: err.details },
      { status: err.status }
    )
  }

  // Known error messages
  if (err instanceof Error) {
    if (err.message.startsWith('Forbidden') || err.message === 'Forbidden') {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err.message.startsWith('Unauthorized') || err.message === 'Unauthorized') {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    if (err.message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
  }
  
  // Zod validation
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', details: err.flatten().fieldErrors },
      { status: 400 }
    )
  }
  
  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Duplicate value' }, { status: 409 })
    }
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }
  
  // Unknown — log and return generic 500
  console.error('[unhandled-api-error]', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
