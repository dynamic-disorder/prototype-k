// Pure logic of filter-unresolved.mjs (no file system, process or network access) so it can be unit tested.
// A thread is a top-level review comment (no in_reply_to_id). It is unresolved when it has no replies
// or the last reply is not from the PR author.

export const USAGE = 'Usage: filter-unresolved.mjs <review_comments.json> <pr_author>';

const day = iso => (iso ?? '').slice(0, 10);

// comments = parsed GitHub "pulls/N/comments" array. Returns the markdown report, ending with a newline.
export function filterUnresolved(comments, prAuthor) {
  const threads = comments.filter(c => c.id != null && c.in_reply_to_id == null);
  const replies = new Map();
  for (const c of comments.filter(c => c.id != null && c.in_reply_to_id != null)) {
    replies.set(c.in_reply_to_id, [...(replies.get(c.in_reply_to_id) ?? []), c]);
  }
  const unresolved = threads.filter(t => {
    const last = replies.get(t.id)?.at(-1);
    return !last || last.user?.login !== prAuthor;
  });

  const lines = ['# Unresolved Review Comments', '', `**PR Author:** ${prAuthor}`, `**Total threads:** ${threads.length}`, ''];
  unresolved.forEach((t, i) => {
    const rs = replies.get(t.id) ?? [];
    const where = t.original_line != null ? `${t.path}:${t.original_line}` : t.path;
    lines.push(`## ${i + 1}. **${t.user?.login ?? ''}** on \`${where}\``, '', `**Date:** ${day(t.created_at)}`, '');
    lines.push(rs.length ? `**Replies:** ${rs.length} (last by ${rs.at(-1).user?.login ?? ''})` : '**Replies:** 0 (no discussion yet)', '');
    lines.push('**Comment:**', '', t.body ?? '', '');
    if (rs.length) {
      lines.push('<details><summary>Show replies</summary>', '');
      for (const r of rs) lines.push(`**${r.user?.login ?? ''}:**`, '', r.body ?? '', '');
      lines.push('</details>', '');
    }
    lines.push('---', '');
  });
  lines.push('', `**Total unresolved:** ${unresolved.length}/${threads.length}`);
  return lines.join('\n') + '\n';
}

// deps: { readFile(path) -> string | null (null when missing), out(text), err(text) }. Returns the exit code.
export function runFilter(argv, deps) {
  const [file, author] = argv;
  const fail = message => { deps.err(`${message}\n`); return 1; };
  if (!file || !author) return fail(`ERROR: Missing required arguments.\n${USAGE}`);
  const text = deps.readFile(file);
  if (text === null) return fail(`ERROR: Comments file not found: ${file}`);
  let comments;
  try {
    comments = JSON.parse(text);
  } catch (e) {
    return fail(`ERROR: ${file} is not valid JSON (${e.message}).`);
  }
  if (!Array.isArray(comments)) return fail(`ERROR: ${file} must hold a JSON array of review comments.`);
  deps.out(filterUnresolved(comments, author));
  return 0;
}
