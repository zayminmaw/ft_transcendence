// A LIKE pattern that finds the text anywhere, with its own wildcards escaped.
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}
