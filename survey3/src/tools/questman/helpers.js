export function RANDOM(max) {
  return Math.round(Math.random() * (max));
}

export function RANDOMWORD() {
  const words = ['some', 'random', 'words']
  return words[RANDOM(words.length - 1)]
}
