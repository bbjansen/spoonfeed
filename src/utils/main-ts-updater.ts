import * as fs from 'node:fs';

export interface BlockImport {
  defaultImport?: string;
  namedImports: string[];
  moduleSpecifier: string;
}

export interface BlockDefinition {
  imports: BlockImport[];
  code: string;
}

const START_MARKER = (blockId: string) => `// --- ${blockId} start ---`;
const END_MARKER = (blockId: string) => `// --- ${blockId} end ---`;

function formatImportStatement(imp: BlockImport): string {
  const parts: string[] = [];
  if (imp.defaultImport) parts.push(imp.defaultImport);
  if (imp.namedImports.length > 0) parts.push(`{ ${imp.namedImports.join(', ')} }`);
  return `import ${parts.join(', ')} from '${imp.moduleSpecifier}';`;
}

/**
 * Inserts a delimited code block into main.ts before the `await app.listen` line.
 *
 * The block is wrapped with start/end markers for clean removal later.
 * Import declarations are added at the top of the file.
 *
 * Idempotent: skips if the start marker already exists in the file.
 */
export function insertBlock(filePath: string, blockId: string, block: BlockDefinition): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const result = insertBlockToString(content, blockId, block);
  if (result !== content) {
    fs.writeFileSync(filePath, result, 'utf-8');
  }
}

/**
 * Inserts a delimited code block into a main.ts source string (in-memory, no filesystem access).
 * Returns the transformed source text.
 */
export function insertBlockToString(
  source: string,
  blockId: string,
  block: BlockDefinition,
): string {
  let content = source;

  // Guard: skip if block already exists
  if (content.includes(START_MARKER(blockId))) return content;

  // Add import declarations at the top of the file (after existing imports)
  if (block.imports.length > 0) {
    const importStatements = block.imports.map((imp) => formatImportStatement(imp)).join('\n');

    const lines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        lastImportIdx = i;
      }
    }

    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, importStatements);
    } else {
      lines.unshift(importStatements);
    }

    content = lines.join('\n');
  }

  // Insert the delimited block before `await app.listen`
  const delimitedBlock = [
    '',
    `  ${START_MARKER(blockId)}`,
    block.code,
    `  ${END_MARKER(blockId)}`,
    '',
  ].join('\n');

  const listenPattern = /^(\s*(?:const\s+\w+\s*=\s*)?(?:await\s+)?app\.listen)/m;
  const listenMatch = content.match(listenPattern);

  if (listenMatch && listenMatch.index !== undefined) {
    content =
      content.slice(0, listenMatch.index) +
      delimitedBlock +
      '\n' +
      content.slice(listenMatch.index);
  } else {
    // Secondary anchor: insert after `await app.init()` (Lambda pattern)
    const initPattern = /^(\s*await\s+app\.init\(\)\s*;?\s*)$/m;
    const initMatch = content.match(initPattern);

    if (initMatch && initMatch.index !== undefined) {
      const insertAfter = initMatch.index + initMatch[0].length;
      content =
        content.slice(0, insertAfter) + '\n' + delimitedBlock + content.slice(insertAfter);
    } else {
      // Fallback: insert before the last closing brace of the bootstrap function
      const lastBraceIdx = content.lastIndexOf('}');
      if (lastBraceIdx >= 0) {
        content =
          content.slice(0, lastBraceIdx) + delimitedBlock + '\n' + content.slice(lastBraceIdx);
      } else {
        content += delimitedBlock;
      }
    }
  }

  // Clean up excessive blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  return content;
}

/**
 * Removes a delimited code block from main.ts by its block ID.
 *
 * Removes everything between the start/end markers (inclusive) and
 * optionally removes import declarations for the specified module specifiers.
 *
 * No-op if the block markers are not found.
 */
export function removeBlock(
  filePath: string,
  blockId: string,
  importModuleSpecifiers: string[],
): void {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  const result = removeBlockFromString(content, blockId, importModuleSpecifiers);
  if (result !== content) {
    fs.writeFileSync(filePath, result, 'utf-8');
  }
}

/**
 * Removes a delimited code block from a main.ts source string (in-memory, no filesystem access).
 * Returns the transformed source text.
 */
export function removeBlockFromString(
  source: string,
  blockId: string,
  importModuleSpecifiers: string[],
): string {
  let content = source;

  const startMarker = START_MARKER(blockId);
  const endMarker = END_MARKER(blockId);

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return content;

  const lineStartIdx = content.lastIndexOf('\n', startIdx);
  const lineEndIdx = content.indexOf('\n', endIdx + endMarker.length);

  const before = lineStartIdx >= 0 ? content.slice(0, lineStartIdx) : '';
  const after = lineEndIdx >= 0 ? content.slice(lineEndIdx) : '';
  content = before + after;

  for (const specifier of importModuleSpecifiers) {
    content = removeImportBySpecifier(content, specifier);
  }

  content = content.replace(/\n{3,}/g, '\n\n');
  content = content.trimEnd() + '\n';

  return content;
}

/**
 * Removes an import statement for the given module specifier, handling both
 * single-line and multi-line (Prettier-formatted) imports.
 *
 * Strategy: walk lines to find spans that form a complete import from the
 * target specifier, then splice them out.
 */
function removeImportBySpecifier(source: string, specifier: string): string {
  const lines = source.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line starts an import statement
    if (/^\s*import\s/.test(line)) {
      // Accumulate lines until we find the end of the import statement (a line containing `from` + semicolon or just a semicolon)
      const importLines = [line];
      let j = i;

      // A complete import has `from '...'` (with optional semicolon). Keep
      // accumulating lines until we find one that contains the `from` clause
      // or a bare semicolon closing a side-effect import.
      while (!isImportComplete(importLines.join('\n')) && j + 1 < lines.length) {
        j++;
        importLines.push(lines[j]);
      }

      const fullImport = importLines.join('\n');

      // Check if this import is for the target specifier
      const specifierPattern = new RegExp(
        `from\\s+['"]${escapeRegex(specifier)}['"]`,
      );

      if (specifierPattern.test(fullImport)) {
        // Skip all lines of this import (don't add to result)
        i = j + 1;
        continue;
      }
    }

    result.push(line);
    i++;
  }

  return result.join('\n');
}

/**
 * Determines whether a (possibly partial) import statement string is complete.
 * An import is complete when it contains a `from '...'` clause followed by an
 * optional semicolon, or is a side-effect import like `import 'foo';`.
 */
function isImportComplete(text: string): boolean {
  // Side-effect import: import 'module';
  if (/^\s*import\s+['"]/.test(text) && /['"];?\s*$/.test(text)) return true;
  // Standard import with from clause
  if (/from\s+['"][^'"]*['"];?\s*$/.test(text)) return true;
  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
