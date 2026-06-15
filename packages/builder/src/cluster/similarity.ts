export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let s = 0
  const n = a.length
  for (let i = 0; i < n; i++) {
    s += a[i]! * b[i]!
  }
  return s
}

export interface ClusterPoint {
  id: string
  vec: Float32Array
}

export interface Cluster {
  members: { id: string, sim: number }[]
}

/**
 * Single-linkage connected components on cosine similarity.
 * Returns clusters with at least 2 members.
 */
export function buildClusters(points: ClusterPoint[], threshold: number): Cluster[] {
  const n = points.length
  if (n === 0) {
    return []
  }

  const parent = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    parent[i] = i
  }
  const find = (x: number): number => {
    let r = x
    while (parent[r] !== r) {
      r = parent[r]!
    }
    let cur = x
    while (parent[cur] !== r) {
      const next = parent[cur]!
      parent[cur] = r
      cur = next
    }
    return r
  }
  const union = (a: number, b: number): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) {
      parent[rb] = ra
    }
  }

  for (let i = 0; i < n; i++) {
    const vi = points[i]!.vec
    for (let j = i + 1; j < n; j++) {
      if (cosineSimilarity(vi, points[j]!.vec) >= threshold) {
        union(i, j)
      }
    }
  }

  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    const arr = groups.get(r)
    if (arr) {
      arr.push(i)
    }
    else {
      groups.set(r, [i])
    }
  }

  const out: Cluster[] = []
  for (const idxs of groups.values()) {
    if (idxs.length < 2) {
      continue
    }
    const first = points[idxs[0]!]!
    const members = idxs.map(idx => ({
      id: points[idx]!.id,
      sim: idx === idxs[0] ? 1 : cosineSimilarity(first.vec, points[idx]!.vec),
    }))
    members.sort((a, b) => b.sim - a.sim)
    out.push({ members })
  }

  out.sort((a, b) => b.members.length - a.members.length)
  return out
}
