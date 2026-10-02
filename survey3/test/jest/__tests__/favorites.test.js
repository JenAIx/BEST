// Angeheftete Fragebögen auf /select
// Run: npx jest test/jest/__tests__/favorites.test.js
import { orderWithFavorites, toggleFavorite } from 'src/tools/questman/favorites'

describe('Favoriten', () => {
  const list = ['a', 'b', 'c', 'd']
  test('angeheftete zuerst, in Anheft-Reihenfolge, Rest unverändert', () => {
    expect(orderWithFavorites(list, ['c', 'a'])).toEqual(['c', 'a', 'b', 'd'])
  })
  test('Favoriten außerhalb der (gefilterten) Liste erscheinen nicht', () => {
    expect(orderWithFavorites(['b', 'd'], ['c', 'd'])).toEqual(['d', 'b'])
  })
  test('ohne Favoriten bleibt alles, wie es ist', () => {
    expect(orderWithFavorites(list, undefined)).toEqual(list)
    expect(orderWithFavorites(list, [])).toEqual(list)
  })
  test('anheften hängt hinten an, nochmal löst', () => {
    expect(toggleFavorite(['a'], 'c')).toEqual(['a', 'c'])
    expect(toggleFavorite(['a', 'c'], 'a')).toEqual(['c'])
    expect(toggleFavorite(null, 'x')).toEqual(['x'])
  })
})
