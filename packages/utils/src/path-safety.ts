import path from 'node:path'

export function isPathInside(parent: string, child: string): boolean {
  const resolvedParent = path.resolve(parent)
  const resolvedChild = path.resolve(child)
  const relative = path.relative(resolvedParent, resolvedChild)

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}
