import { ScrollArea } from '@afilmory/ui'

const SAMPLE_PHOTO_ID = 'DSCF5432'
const SAMPLE_PHOTO_ASPECT = '3:2'
const SAMPLE_PHOTOS = ['DSCF5432', 'DSCF3260', 'DSCF3174', 'DSCF2873', 'DSCF0419-2'].join(',')
const SAMPLE_TAG = '.afilmory'

const EmbedSnippet = ({ data }: { data: Record<string, string> }) => (
  <script async src="/share/embed.js" {...data} suppressHydrationWarning />
)

export const Component = () => {
  return (
    <ScrollArea rootClassName="h-screen bg-fill-quaternary">
      <article className="mx-auto max-w-[68ch] px-6 py-16 text-text">
        <header className="mb-10">
          <p className="text-text-tertiary mb-2 text-xs tracking-wide uppercase">Field journal</p>
          <h1 className="text-text mb-4 text-4xl leading-tight font-bold tracking-tight">
            Notes from a quiet week behind the camera
          </h1>
          <p className="text-text-secondary text-sm">
            <span className="font-medium">Innei</span>
            <span className="text-text-tertiary mx-2">·</span>
            <span>June 16, 2026</span>
            <span className="text-text-tertiary mx-2">·</span>
            <span>6 min read</span>
          </p>
        </header>

        <section className="space-y-5 leading-relaxed">
          <p>
            Last weekend I gave myself a rule: one lens, one bag, no plan. The constraint was about slowness — letting a
            place fall on me at its own pace rather than chasing pictures. The opening frame below is the one I keep
            returning to. The light arrived almost as an afterthought, late and oblique.
          </p>

          <figure className="my-10">
            <EmbedSnippet
              data={{
                'data-afilmory-photo': SAMPLE_PHOTO_ID,
                'data-aspect': SAMPLE_PHOTO_ASPECT,
                'data-width': '100%',
              }}
            />
            <figcaption className="text-text-tertiary mt-3 text-xs">
              Single-photo embed · auto-sized via postMessage · sandboxed
            </figcaption>
          </figure>

          <p>
            What follows isn't a contact sheet so much as a thread. I edit on the train home; I look for the photographs
            that argue with each other. These five do — they share a palette but disagree about distance.
          </p>

          <figure className="my-10">
            <EmbedSnippet
              data={{
                'data-afilmory-photos': SAMPLE_PHOTOS,
                'data-layout': 'grid',
                'data-width': '100%',
              }}
            />
            <figcaption className="text-text-tertiary mt-3 text-xs">
              Multi-photo embed (explicit list) · 3-col grid · click any tile to open detail
            </figcaption>
          </figure>

          <p>
            Sometimes the better view of a body of work is by category. The tag below pulls in everything I've filed
            under it, capped at nine for the embed; readers can click through to the full filtered gallery.
          </p>

          <figure className="my-10">
            <EmbedSnippet
              data={{
                'data-afilmory-tag': SAMPLE_TAG,
                'data-limit': '9',
                'data-layout': 'grid',
                'data-width': '100%',
              }}
            />
            <figcaption className="text-text-tertiary mt-3 text-xs">
              Tag collection · limit 9 · "+N more" tile appears when total exceeds limit
            </figcaption>
          </figure>

          <p>
            And the same set, rendered as a horizontal strip — for sidebars, captions, or anywhere a tall grid would
            crowd the surrounding text.
          </p>

          <figure className="my-10">
            <EmbedSnippet
              data={{
                'data-afilmory-tag': SAMPLE_TAG,
                'data-limit': '6',
                'data-layout': 'strip',
                'data-width': '100%',
              }}
            />
            <figcaption className="text-text-tertiary mt-3 text-xs">
              Same tag, strip layout · scroll-snap on touch
            </figcaption>
          </figure>

          <p>One narrow column, for sidebars or quoted aside, to confirm the embed degrades nicely below ~360px.</p>

          <figure className="my-10 mx-auto max-w-[320px]">
            <EmbedSnippet
              data={{
                'data-afilmory-photo': SAMPLE_PHOTO_ID,
                'data-aspect': SAMPLE_PHOTO_ASPECT,
                'data-width': '100%',
              }}
            />
            <figcaption className="text-text-tertiary mt-3 text-xs">Narrow column · 320px wide</figcaption>
          </figure>
        </section>

        <footer className="text-text-tertiary border-fill mt-16 border-t pt-8 text-xs">
          <p>
            Embedded with
            {' '}
            <code className="bg-fill text-text-secondary rounded px-1.5 py-0.5">
              &lt;script src="/share/embed.js"&gt;
            </code>
            . No iframe attributes to memorize, no fixed heights to guess. The script self-resizes via
            {' '}
            <code className="bg-fill text-text-secondary rounded px-1.5 py-0.5">postMessage</code>
            {' '}
            once the photo is
            rendered.
          </p>
        </footer>
      </article>
    </ScrollArea>
  )
}
