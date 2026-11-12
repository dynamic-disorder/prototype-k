// Pure logic for resolve-feedback.mjs: PR ref parsing, GraphQL/gh command strings,
// thread shaping, reply verification and messages. No file system, process, env,
// network or child-process access - the runner does all I/O. Unit tested in
// resolve-feedback-lib.test.mjs.

export function parseRef(input) {
  let m = input.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (m) return { owner: m[1], repo: m[2], prNumber: m[3] };
  m = input.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (m) return { owner: m[1], repo: m[2], prNumber: m[3] };
  if (/^\d+$/.test(input)) return { owner: 'CompanyOrOrganizationName', repo: 'product_name', prNumber: input };
  return null;
}

export function allPresent(values) {
  return values.every(v => Boolean(v));
}

export function invalidRefMessage(input) {
  return `Invalid input: "${input}". Provide a PR URL, owner/repo#number, or bare number.`;
}

export function unknownCommandMessage(cmd) {
  return `Unknown command: "${cmd ?? ''}". Use parse|fetch|reply|comment|resolve.`;
}

export function buildFetchQuery(owner, repo, prNumber) {
  return `{
      repository(owner: "${owner}", name: "${repo}") {
        pullRequest(number: ${prNumber}) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              comments(first: 10) {
                nodes { databaseId body path line commit { oid } }
              }
            }
          }
        }
      }
    }`;
}

export function buildFetchCommand(owner, repo, prNumber) {
  const query = buildFetchQuery(owner, repo, prNumber);
  return `gh api graphql -f query='${query.replace(/'/g, "'\\''")}'`;
}

export function notFoundMessage(prNumber, owner, repo) {
  return `PR #${prNumber} not found in ${owner}/${repo}.`;
}

// Returns null when the response has no pull request, else the unresolved threads.
export function shapeThreads(data) {
  const pr = data?.data?.repository?.pullRequest;
  if (!pr) return null;
  return pr.reviewThreads.nodes
    .filter(t => !t.isResolved)
    .map(t => ({
      threadId: t.id,
      comments: t.comments.nodes
        .filter(c => c.databaseId != null)
        .map(c => ({
          commentId: c.databaseId,
          body: c.body,
          path: c.path,
          line: c.line,
          commitId: c.commit?.oid ?? null,
        })),
    }));
}

export function buildCygpathCommand(bodyFile) {
  return `cygpath -m "${bodyFile}" 2>/dev/null || echo "${bodyFile}"`;
}

export function buildReplyCommand({ owner, repo, prNumber, commentId, path, line, commitId, bodyPathNode }) {
  return `gh api "repos/${owner}/${repo}/pulls/${prNumber}/comments" -X POST ` +
    `-F body=@"${bodyPathNode}" -f commit_id="${commitId}" -f path="${path}" -F line=${line} -f side=RIGHT -F in_reply_to=${commentId}`;
}

export function buildCommentCommand({ owner, repo, prNumber, bodyPathNode }) {
  return `gh api "repos/${owner}/${repo}/issues/${prNumber}/comments" -X POST -F body=@"${bodyPathNode}"`;
}

export function buildResolveCommand(threadId) {
  return `gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "${threadId}"}) { thread { id isResolved } } }'`;
}

export function emptyBodyMessage(bodyFile) {
  return `Body file "${bodyFile}" is empty - nothing to post.`;
}

// True when the posted comment body is missing or differs from the intended text.
export function isBodyMismatch(posted, expectedBody) {
  return !posted.body || posted.body.trim() !== expectedBody.trim();
}

export function replyMismatchMessage(posted, owner, repo) {
  return `Posted comment ${posted.id ?? '?'} body does not match the intended reply text - ` +
    `got: ${JSON.stringify((posted.body ?? '').slice(0, 120))}. ` +
    `Fix the mismatched comment (gh api --method PATCH repos/${owner}/${repo}/pulls/comments/${posted.id} -f body="$(cat file)") and rerun.`;
}

export function commentMismatchMessage(posted, owner, repo) {
  return `Posted comment ${posted.id ?? '?'} body does not match the intended text - ` +
    `got: ${JSON.stringify((posted.body ?? '').slice(0, 120))}. ` +
    `Fix the mismatched comment (gh api --method PATCH repos/${owner}/${repo}/issues/comments/${posted.id} -F body=@"<bodyFile>") and rerun.`;
}

export function replyResult(posted) {
  return { ok: true, commentId: posted.id };
}

export function commentResult(posted) {
  return { ok: true, commentId: posted.id, url: posted.html_url };
}
