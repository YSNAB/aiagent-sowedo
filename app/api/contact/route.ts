import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

function sanitizeString(val: unknown, maxLen = 200): string {
  if (typeof val !== 'string') return ''
  return val.trim().slice(0, maxLen)
}

function sanitizeSessionId(id: unknown): string | null {
  if (typeof id !== 'string') return null
  return /^[a-zA-Z0-9_-]{8,64}$/.test(id) ? id : null
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const name = sanitizeString(body.name)
  const email = sanitizeString(body.email)
  const phone = sanitizeString(body.phone)
  const company = sanitizeString(body.company)
  const sessionId = sanitizeSessionId(body.sessionId)

  if (!name || !email || !phone || !company) {
    return Response.json({ error: 'All fields are required.' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email address.' }, { status: 400 })
  }

  const timestamp = new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })

  const record = {
    timestamp,
    sessionId: sessionId ?? 'unknown',
    name,
    email,
    phone,
    company,
  }

  // Persist to contacts.json (append)
  try {
    const dir = path.join(process.cwd(), 'sessions')
    await fs.mkdir(dir, { recursive: true })
    const filePath = path.join(dir, 'contacts.json')

    let existing: typeof record[] = []
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      existing = JSON.parse(raw)
    } catch {
      // First entry
    }

    existing.push(record)
    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8')
  } catch (err) {
    console.error('[contact] Failed to save contact:', err)
    return Response.json({ error: 'Failed to save contact. Please try again.' }, { status: 500 })
  }

  // Append contact details block to the session .md file
  if (sessionId) {
    try {
      const sessionPath = path.join(process.cwd(), 'sessions', `${sessionId}.md`)
      let sessionContent = ''
      try {
        sessionContent = await fs.readFile(sessionPath, 'utf-8')
      } catch {
        // Session file not yet created — skip
      }
      if (sessionContent) {
        const contactBlock = `\n---\n\n## Contact Details\n\n| Field | Value |\n|-------|-------|\n| Name | ${name} |\n| Email | ${email} |\n| Phone | ${phone} |\n| Company | ${company} |\n| Submitted | ${timestamp} |\n`
        await fs.writeFile(sessionPath, sessionContent.trimEnd() + '\n' + contactBlock, 'utf-8')
      }
    } catch (err) {
      console.error('[contact] Failed to update session file:', err)
      // Non-fatal — keep going
    }
  }

  console.log('[contact] New lead submitted:', record)

  return Response.json({ success: true })
}
