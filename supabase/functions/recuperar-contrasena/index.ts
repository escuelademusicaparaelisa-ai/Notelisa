// Notelisa: «¿Has olvidado tu contraseña?» con el teléfono.
// Busca las cuentas con ese teléfono y envía a su email el enlace para elegir una
// contraseña nueva. Nunca dice si había cuenta ni a qué email ha escrito, para que nadie
// pueda averiguar el email de otra persona a partir de su teléfono.
// Cómo publicarla: supabase/LEEME.md, apartado «Recuperar la contraseña».
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** The last 9 digits, so «+34 600 12 34 56» and «600123456» are the same phone. */
const digits = (phone: string) => phone.replace(/\D/g, '').slice(-9)

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const answer = (status = 200) => new Response(JSON.stringify({ ok: status === 200 }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  let body: { telefono?: unknown; volver?: unknown }
  try {
    body = await request.json()
  } catch {
    return answer(400)
  }
  const phone = typeof body.telefono === 'string' ? digits(body.telefono) : ''
  const redirectTo = typeof body.volver === 'string' ? body.volver : undefined
  if (phone.length < 9) return answer(400)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.from('profiles').select('email, telefono').neq('telefono', '')
  if (error) return answer(500)

  // Brothers and sisters may share a parent's phone: each of their accounts gets its email.
  const emails = [...new Set((data ?? []).filter(p => p.email && digits(p.telefono) === phone).map(p => p.email as string))].slice(0, 5)
  for (const email of emails) await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  return answer()
})
