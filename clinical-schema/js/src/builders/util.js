export const isoNow = () => new Date().toISOString()
export const isoDate = (d = new Date()) => new Date(d).toISOString().split('T')[0]

export function uuidv4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const stringifyBlob = (blob) =>
  blob && typeof blob === 'object' ? JSON.stringify(blob) : blob
