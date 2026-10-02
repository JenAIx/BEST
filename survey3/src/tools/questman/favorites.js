// Angeheftete Fragebögen (Favoriten) auf /select: stehen immer oben, in der
// Reihenfolge, in der sie angeheftet wurden. Gespeichert als Liste von
// short_titles in den Settings (favorite_quests). Rein, ohne Vue/Dexie.

// Liste neu ordnen: Favoriten (soweit in list enthalten) zuerst, Rest unverändert.
export function orderWithFavorites(list, favorites) {
  const favs = Array.isArray(favorites) ? favorites : []
  const inList = new Set(list)
  const pinned = favs.filter((k) => inList.has(k))
  const pinnedSet = new Set(pinned)
  return [...pinned, ...list.filter((k) => !pinnedSet.has(k))]
}

// Anheften bzw. lösen; liefert eine neue Liste (neu angeheftet = hinten an).
export function toggleFavorite(favorites, key) {
  const favs = Array.isArray(favorites) ? favorites : []
  return favs.includes(key) ? favs.filter((k) => k !== key) : [...favs, key]
}
