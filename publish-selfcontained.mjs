#!/usr/bin/env node
// Publishes the supported apps as self-contained Windows executables for end-user distribution.
//
// Node port of the former publish-net10-selfcontained.ps1. It exists because PowerShell (`pwsh`)
// is not installed on the Omarchy Linux box, while Node is; and because Node runs identically on
// Windows. Cross-publishing win-x64 from Linux works because this only drives `dotnet publish`.
//
// Deliberately dependency-free: Node built-ins only, so it needs nothing beyond `node` itself.
//
// Usage:
//   node publish-selfcontained.mjs                              # every supported app
//   node publish-selfcontained.mjs AddEntryApp                  # one app
//   node publish-selfcontained.mjs AddEntryApp,TextToSpeechApp  # several (comma-separated)
//   node publish-selfcontained.mjs --project AddEntryApp        # same, via flag
//   node publish-selfcontained.mjs --runtime win-x64 --configuration Release
//   node publish-selfcontained.mjs --no-trim                    # keep PublishTrimmed off
//
// Output: publish/<App>/<runtime>/<configuration>/

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const projects = {
  AddEntryApp: 'CsvTranslations/AddEntryApp/AddEntryApp.csproj',
  OllamaTranslatorApp: 'CsvTranslations/OllamaTranslatorApp/OllamaTranslatorApp.csproj',
  TextFileSplitterApp: 'CsvTranslations/TextFileSplitterApp/TextFileSplitterApp.csproj',
  TextToSpeechApp: 'CsvTranslations/TextToSpeechApp/TextToSpeechApp.csproj',
};

const repoRoot = dirname(fileURLToPath(import.meta.url));

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (useColour ? `\u001b[${code}m${text}\u001b[0m` : text);
const bold = (t) => paint('1', t);
const cyan = (t) => paint('36', t);
const green = (t) => paint('32', t);
const yellow = (t) => paint('33', t);
const red = (t) => paint('31', t);
const grey = (t) => paint('90', t);

const usage = `${bold('Publish self-contained app bundles')}

  node publish-selfcontained.mjs [app ...] [options]

Apps:    ${Object.keys(projects).join(', ')}
Options:
  -p, --project <name>     App to publish (repeatable; same as positional)
  -r, --runtime <rid>      Target runtime identifier (default: win-x64)
  -c, --configuration <c>  Build configuration (default: Release)
      --no-trim            Disable PublishTrimmed (it is on by default)
  -h, --help               Show this help

With no app given, every supported app is published.`;

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      project: { type: 'string', multiple: true, short: 'p' },
      runtime: { type: 'string', short: 'r', default: 'win-x64' },
      configuration: { type: 'string', short: 'c', default: 'Release' },
      'no-trim': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
} catch (error) {
  console.error(red(`error: ${error.message}`));
  console.error();
  console.error(usage);
  process.exit(2);
}

const { values, positionals } = parsed;
const { runtime, configuration } = values;
const trim = !values['no-trim'];

if (values.help) {
  console.log(usage);
  process.exit(0);
}

// Names may arrive as comma-separated positionals (the PowerShell ergonomics) or as repeated
// --project flags; accept both and de-duplicate.
const requested = [...positionals, ...(values.project ?? [])]
  .flatMap((value) => value.split(','))
  .map((value) => value.trim())
  .filter(Boolean);

const names = requested.length > 0 ? [...new Set(requested)] : Object.keys(projects);

const unknown = names.filter((name) => !Object.hasOwn(projects, name));
if (unknown.length > 0) {
  console.error(red(`Unknown app(s): ${unknown.join(', ')}`));
  console.error(`Supported apps: ${Object.keys(projects).join(', ')}`);
  process.exit(1);
}

console.log(bold('Publishing self-contained apps'));
console.log(grey(`Runtime:       ${runtime}`));
console.log(grey(`Configuration: ${configuration}`));
console.log(grey(`Trimming:      ${trim ? 'on' : 'off'}`));
console.log(grey(`Repository:    ${repoRoot}`));
console.log();

for (const name of names) {
  const csprojPath = join(repoRoot, projects[name]);
  const publishDir = join(repoRoot, 'publish', name, runtime, configuration);

  mkdirSync(publishDir, { recursive: true });
  console.log(green(`Publishing ${name}...`));

  const dotnetArgs = [
    'publish',
    csprojPath,
    '-c', configuration,
    '-r', runtime,
    '--self-contained', 'true',
    '/p:PublishSingleFile=true',
    `/p:PublishTrimmed=${trim}`,
    '/p:PublishReadyToRun=false',
    '/p:IncludeAllContentForSelfExtract=true',
    '-o', publishDir,
  ];

  const result = spawnSync('dotnet', dotnetArgs, { cwd: repoRoot, stdio: 'inherit' });

  if (result.error) {
    console.error(red(`Failed to run dotnet: ${result.error.message}`));
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(red(`Publish failed for ${name} (exit code ${result.status}).`));
    process.exit(result.status ?? 1);
  }

  console.log(cyan(`Published ${name} -> ${publishDir}`));
  console.log();
}

console.log(green('Publish complete. Review the generated bundles under publish/.'));
