import { SHARE_EMBED_SCRIPT } from '@afilmory/sdk'

export const dynamic = 'force-static'

export async function GET() {
  return new Response(SHARE_EMBED_SCRIPT, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400',
    },
  })
}
