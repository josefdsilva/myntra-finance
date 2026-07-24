// Generate a key-first ENTRIES table from the current assembled messages.
// Uses the runtime object (not text parsing), so it can't drift from reality.
//
//   bun scripts/i18n-export-key-first.mjs > src/lib/i18n-entries.generated.ts
//
// Review the output, then make it the ENTRIES export in i18n-entries.ts and
// delete the legacy per-locale blocks in i18n-messages.ts. tsc will confirm the
// key set is unchanged.
import { messages, SUPPORTED_LOCALES } from "../src/lib/i18n-messages";

const keys = Object.keys(messages.en).sort();
const lines = keys.map((k) => {
  const parts = SUPPORTED_LOCALES.map((l) => `${l}: ${JSON.stringify(messages[l][k])}`).join(", ");
  return `  ${JSON.stringify(k)}: { ${parts} },`;
});

process.stdout.write(
  `import type { Locale } from "./i18n-messages";\n\n` +
    `// AUTO-GENERATED. Review, then replace the ENTRIES export in i18n-entries.ts.\n` +
    `export const ENTRIES = {\n${lines.join("\n")}\n} satisfies Record<string, Record<Locale, string>>;\n`,
);
