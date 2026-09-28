export function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  return `${u === 0 ? v : v.toFixed(1)} ${units[u]}`
}
