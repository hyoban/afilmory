import { getSiteName } from './utils'

interface BadgeProps {
  href: string
  inline?: boolean
}

export function Badge({ href, inline = false }: BadgeProps) {
  return (
    <a
      className={inline ? 'af-badge af-badge-inline' : 'af-badge'}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="af-badge-dot" />
      {getSiteName()}
      <span className="af-badge-via">via AFilmory</span>
    </a>
  )
}
