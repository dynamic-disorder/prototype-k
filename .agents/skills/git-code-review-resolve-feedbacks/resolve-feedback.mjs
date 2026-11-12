#!/usr/bin/env node
// Mechanical gh/GraphQL plumbing for resolving GitHub PR review threads.
// Handles: parsing a PR ref, fetching unresolved threads (with the reply-
// target commit oid inlined via GraphQL, avoiding a second REST call per
// comment), posting a threaded reply, and resolving a thread. The
// classification/reply-content judgment stays with Claude - this script
// only does the plumbing.
//
// Usage:
//   node resolve-feedback.mjs parse <pr-ref>
//   node resolve-feedback.mjs fetch <owner> <repo> <prNumber>
//   node resolve-feedback.mjs reply <owner> <repo> <prNumber> <commentId> <path> <line> <commitId> <bodyFile>
//   node resolve-feedback.mjs resolve <threadId>
//   node resolve-feedback.mjs comment <owner> <repo> <prNumber> <bodyFile>
//
// All commands print JSON to stdout on success, a message to stderr and
// exit 1 on failure.
//
// Runner only: args, gh calls, file reads, exit codes. The pure logic (ref
// parsing, command/query strings, thread shaping, reply verification) lives in
// resolve-feedback-lib.mjs and is unit tested.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  parseRef, allPresent, invalidRefMessage, unknownCommandMessage,
  buildFetchCommand, notFoundMessage, shapeThreads,
  buildCygpathCommand, buildReplyCommand, buildCommentCommand, buildResolveCommand,
  emptyBodyMessage, isBodyMismatch, replyMismatchMessage, commentMismatchMessage,
  replyResult, commentResult,
} from './resolve-feedback-lib.mjs';

// Shell out through bash explicitly - cmd.exe (execSync's default on
// Windows) mishandles single-quoted --jq/-f query args used below.
function bash(cmd, opts = {}) {
  return execFileSync('bash', ['-c', cmd], { encoding: 'utf8', ...opts });
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'parse': {
    const ref = parseRef(args[0] ?? '');
    if (!ref) fail(invalidRefMessage(args[0] ?? ''));
    console.log(JSON.stringify(ref));
    break;
  }

  case 'fetch': {
    const [owner, repo, prNumber] = args;
    if (!allPresent([owner, repo, prNumber])) fail('Usage: fetch <owner> <repo> <prNumber>');

    let raw;
    try {
      raw = bash(buildFetchCommand(owner, repo, prNumber));
    } catch (err) {
      fail(`GraphQL fetch failed: ${err.message}`);
    }

    const data = JSON.parse(raw);
    const threads = shapeThreads(data);
    if (!threads) fail(notFoundMessage(prNumber, owner, repo));

    console.log(JSON.stringify(threads));
    break;
  }

  case 'reply': {
    const [owner, repo, prNumber, commentId, path, line, commitId, bodyFile] = args;
    if (!allPresent([owner, repo, prNumber, commentId, path, line, commitId, bodyFile])) {
      fail('Usage: reply <owner> <repo> <prNumber> <commentId> <path> <line> <commitId> <bodyFile>');
    }

    let expectedBody;
    try {
      expectedBody = readFileSync(bodyFile, 'utf8');
    } catch (err) {
      fail(`Could not read body file "${bodyFile}": ${err.message}`);
    }
    if (!expectedBody.trim()) fail(emptyBodyMessage(bodyFile));

    // -F (typed field) with @<path> reads the field value from that file.
    // -f (raw-field) with @- does NOT read from stdin here - it sends the
    // literal string "@-" as the body. Confirmed empirically on gh 2.93.0.
    // This bit us for real once: an ad hoc `-f body=@file` call (outside
    // this script) silently posted the literal path string to a reviewer on
    // 8 threads before anyone noticed. Never touch a `gh api ... body`
    // field without going through this function.
    const bodyPathNode = bash(buildCygpathCommand(bodyFile)).trim();
    let posted;
    try {
      const raw = bash(
        buildReplyCommand({ owner, repo, prNumber, commentId, path, line, commitId, bodyPathNode })
      );
      posted = JSON.parse(raw);
    } catch (err) {
      fail(`Reply post failed: ${err.message}`);
    }

    // Verify what actually landed rather than trusting a 0 exit code - the
    // exact failure mode above (gh accepting -f body=@path as a literal
    // string) exits 0 with a "successful" response whose body is just
    // wrong, so a post-hoc read-back is the only thing that would have
    // caught it.
    if (isBodyMismatch(posted, expectedBody)) {
      fail(replyMismatchMessage(posted, owner, repo));
    }
    console.log(JSON.stringify(replyResult(posted)));
    break;
  }

  case 'comment': {
    // General top-level PR/issue comment (e.g. a summary reply), as opposed
    // to `reply`'s threaded review comment. Separate REST endpoint
    // (issues/comments, not pulls/comments) but the same body=@file footgun
    // applies - route every summary-comment post through here instead of an
    // ad hoc `gh api` call. See the `reply` case above for the incident this
    // guards against.
    const [owner, repo, prNumber, bodyFile] = args;
    if (!allPresent([owner, repo, prNumber, bodyFile])) {
      fail('Usage: comment <owner> <repo> <prNumber> <bodyFile>');
    }

    let expectedBody;
    try {
      expectedBody = readFileSync(bodyFile, 'utf8');
    } catch (err) {
      fail(`Could not read body file "${bodyFile}": ${err.message}`);
    }
    if (!expectedBody.trim()) fail(emptyBodyMessage(bodyFile));

    const bodyPathNode = bash(buildCygpathCommand(bodyFile)).trim();
    let posted;
    try {
      const raw = bash(
        buildCommentCommand({ owner, repo, prNumber, bodyPathNode })
      );
      posted = JSON.parse(raw);
    } catch (err) {
      fail(`Comment post failed: ${err.message}`);
    }

    if (isBodyMismatch(posted, expectedBody)) {
      fail(commentMismatchMessage(posted, owner, repo));
    }
    console.log(JSON.stringify(commentResult(posted)));
    break;
  }

  case 'resolve': {
    const [threadId] = args;
    if (!threadId) fail('Usage: resolve <threadId>');
    try {
      bash(buildResolveCommand(threadId));
    } catch (err) {
      fail(`Resolve failed: ${err.message}`);
    }
    console.log(JSON.stringify({ ok: true }));
    break;
  }

  default:
    fail(unknownCommandMessage(cmd));
}
