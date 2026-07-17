/**
 * Minimal CLI progress spinner and live stats display.
 * Zero deps — pure Node.js process.stdout.write + ANSI escapes.
 */

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;

export interface SpinnerHandle {
  update(message: string): void;
  succeed(message: string): void;
  fail(message: string): void;
  stop(): void;
}

const isTTY = Boolean(process.stderr.isTTY);

function clearLine(): void {
  if (!isTTY) return;
  process.stderr.write('\r\x1b[K');
}

/**
 * Start a spinner on stderr with an initial `message`.
 * Returns a handle to update text, succeed, fail, or stop.
 */
export function startSpinner(message: string): SpinnerHandle {
  let frame = 0;
  let current = message;
  let timer: ReturnType<typeof setInterval> | null = null;

  function render(): void {
    if (!isTTY) return;
    clearLine();
    process.stderr.write(`${FRAMES[frame % FRAMES.length]} ${current}`);
    frame++;
  }

  if (isTTY) {
    timer = setInterval(render, INTERVAL_MS);
  } else {
    process.stderr.write(`  ${message}\n`);
  }

  const stop = (): void => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    clearLine();
  };

  return {
    update(msg: string): void {
      current = msg;
      if (!isTTY) process.stderr.write(`  ${msg}\n`);
    },
    succeed(msg: string): void {
      stop();
      process.stderr.write(`✓ ${msg}\n`);
    },
    fail(msg: string): void {
      stop();
      process.stderr.write(`✗ ${msg}\n`);
    },
    stop,
  };
}

export interface LiveStats {
  scanned: number;
  violations: number;
  passes: number;
}

/**
 * Render a one-line live stats summary on stderr.
 * Call from within a crawl loop; no timer — caller drives updates.
 */
export function printLiveStats(label: string, stats: LiveStats): void {
  const line = `${label} | scanned: ${stats.scanned} | violations: ${stats.violations} | passes: ${stats.passes}`;
  if (isTTY) {
    clearLine();
    process.stderr.write(line);
  } else {
    process.stderr.write(`${line}\n`);
  }
}

/** Flush a newline so the cursor lands on a fresh line after live output. */
export function endLiveStats(): void {
  if (isTTY) process.stderr.write('\n');
}
