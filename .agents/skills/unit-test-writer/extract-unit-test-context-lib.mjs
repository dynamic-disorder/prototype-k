// Pure logic of extract-unit-test-context.mjs (no file system, process or network access).
// Unit tested in extract-unit-test-context-lib.test.mjs.

const CLASS_RE = /(?:public\s+)?(?:partial\s+)?(?:abstract\s+)?class\s+(\w+)/g;
const METHOD_RE = /public\s+(?:async\s+)?(?:virtual\s+)?(\w+)\s+(\w+)\s*\([^)]*\)/g;
const FIELD_RE = /private\s+(?:readonly\s+)?(\w+)\s+(\w+)/g;
const MAX_LISTED = 5;

// Known quirk, pinned by the tests: the "class " keyword is stripped but the modifiers stay ("public partial OrderService").
export const extractClasses = (content) => (content.match(CLASS_RE) ?? []).map((m) => m.replace(/class\s+/, ''));

export const extractMethods = (content) =>
  [...content.matchAll(METHOD_RE)].map((m) => ({ returnType: m[1], name: m[2] })).slice(0, MAX_LISTED);

export const extractDependencies = (content) =>
  [...content.matchAll(FIELD_RE)].map((m) => ({ type: m[1], name: m[2] })).slice(0, MAX_LISTED);

export function detectTestFramework(content) {
  if (content.includes('using Xunit')) return 'xunit';
  if (content.includes('using NUnit.Framework')) return 'nunit';
  return 'unknown';
}

// existingTestsHint: output of `find <dir> -name "*Tests.cs" -o -name "*UnitTests.cs"`; empty when none found.
export function buildContext(filePath, content, existingTestsHint) {
  const methods = extractMethods(content);
  const dependencies = extractDependencies(content);
  const testFramework = detectTestFramework(content);
  return {
    filePath,
    classes: extractClasses(content),
    methodCount: methods.length,
    methods,
    dependencyCount: dependencies.length,
    dependencies,
    testFramework,
    hasExistingTests: existingTestsHint.length > 0,
    conventions: {
      testNamingStyle: 'Method_Scenario_Expected',
      mockPrefix: 'no prefix (semantic names only)',
      testFramework,
    },
  };
}

export const findExistingTestsCommand = (filePath) =>
  `find "$(dirname "${filePath}")" -name "*Tests.cs" -o -name "*UnitTests.cs" 2>/dev/null | head -3`;

// deps: { readFile(path), bash(cmd) -> string ('' on failure) }
export function extractUnitTestContext(filePath, deps) {
  try {
    const content = deps.readFile(filePath);
    return buildContext(filePath, content, deps.bash(findExistingTestsCommand(filePath)));
  } catch (err) {
    return { error: `Failed to extract context: ${err.message}`, filePath };
  }
}
