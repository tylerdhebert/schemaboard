/** BFS flood-fill through FK edges (bidirectional) to find the full connected subgraph. */
export function traceFkChain(startId: string, neighbors: Map<string, string[]>): string[] {
  const visited = new Set<string>([startId])
  const queue = [startId]
  while (queue.length) {
    for (const n of neighbors.get(queue.shift()!) ?? []) {
      if (!visited.has(n)) { visited.add(n); queue.push(n) }
    }
  }
  return [...visited]
}
