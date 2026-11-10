/** Command-line parsing for the pipeline scripts. */

/**
 * Take the optional `--seconds <n>` length out of argv and leave the rest.
 *
 * Returns `{ seconds, error, rest }`: `seconds` is a number when the flag was
 * given, `error` names a malformed flag, and `rest` is argv without the flag
 * and its value (so task-folder detection still works).
 */
export function takeSeconds(args) {
  const rest = [];
  let seconds;
  let error = null;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--seconds') {
      rest.push(args[index]);
      continue;
    }

    const raw = args[index + 1];
    if (raw === undefined || raw.startsWith('--')) {
      error = '--seconds needs a length in seconds, for example --seconds 45';
      continue;
    }

    const value = Number(raw);
    if (!Number.isFinite(value)) {
      error = `--seconds is not a number: ${raw}`;
    } else {
      seconds = value;
    }
    index += 1;
  }

  return { seconds, error, rest };
}
