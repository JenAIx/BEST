/**
 * Small string hash (djb2 variant, same as migration-manager.calculateChecksum)
 * — for cache-key scoping, never for security.
 * @param {string} input
 * @returns {string} base36 digest
 */
export function shortHash(input) {
  const str = String(input ?? '')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
