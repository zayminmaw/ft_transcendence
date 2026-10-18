import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

export const NEEDS_TERMINAL = 'Run this command in an interactive terminal, e.g. docker compose exec -it backend npm run create-platform-admin';

// One interface for all visible questions: a second interface would miss lines the first one already buffered.
export async function askVisible(questions: string[]): Promise<string[]> {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const answers: string[] = [];
    for (const question of questions) answers.push(await readline.question(question));
    return answers;
  } finally {
    readline.close();
  }
}

// Reads a line without showing it. Needs a real terminal.
export function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(new Error(NEEDS_TERMINAL));
      return;
    }
    stdout.write(question);
    let value = '';
    const finish = (error?: Error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u0003') return finish(new Error('Cancelled.'));
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else value += character;
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}
