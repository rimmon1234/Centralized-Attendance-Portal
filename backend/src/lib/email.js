import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

/**
 * Send an email using Gmail API (OAuth2 over HTTPS) or Resend fallback.
 */
export async function sendEmail({ to, subject, html }) {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  const sender = process.env.GMAIL_SENDER || process.env.EMAIL_USER

  if (clientId && clientSecret && refreshToken && sender) {
    try {
      const { google } = await import('googleapis')
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground'
      )

      oauth2Client.setCredentials({ refresh_token: refreshToken })
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

      const rawMessage = [
        `From: ${sender}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        '',
        html,
      ].join('\n')

      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      })
      console.log('[email] Gmail API sent', {
        to,
        messageId: response?.data?.id || null,
      })
      return { success: true, data: { messageId: response?.data?.id } }
    } catch (err) {
      console.error('[email] Gmail API error:', err)
      return { success: false, error: err.message || String(err) }
    }
  }

  if (!process.env.RESEND_API_KEY) {
    console.log('--- EMAIL SIMULATION ---')
    console.log(`To: ${to}`)
    console.log(`Subject: ${subject}`)
    console.log(`Body: ${html}`)
    console.log('------------------------')
    return { success: true, simulated: true }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { data, error } = await resend.emails.send({
      from: 'Attendance Portal <onboarding@resend.dev>',
      to,
      subject,
      html,
    })

    if (error) {
      console.error('[email] Resend error:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (err) {
    console.error('[email] Unexpected error:', err)
    return { success: false, error: err.message }
  }
}
