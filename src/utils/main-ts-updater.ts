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

  let content = fs.readFileSync(filePath, 'utf-8');

  // Guard: skip if block already exists
  if (content.includes(START_MARKER(blockId))) return;

  // Add import declarations at the top of the file (after existing imports)
  if (block.imports.length > 0) {
    const importStatements = block.imports.map((imp) => formatImportStatement(imp)).join('\n');

    // Find the last import statement and insert after it
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
      // No existing imports — add at top
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
    // Fallback: insert before the last closing brace of the bootstrap function
    const lastBraceIdx = content.lastIndexOf('}');
    if (lastBraceIdx >= 0) {
      content =
        content.slice(0, lastBraceIdx) + delimitedBlock + '\n' + content.slice(lastBraceIdx);
    } else {
      content += delimitedBlock;
    }
  }

  // Clean up excessive blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(filePath, content, 'utf-8');
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
    const lastBraceIdx = content.lastIndexOf('}');
    if (lastBraceIdx >= 0) {
      content =
        content.slice(0, lastBraceIdx) + delimitedBlock + '\n' + content.slice(lastBraceIdx);
    } else {
      content += delimitedBlock;
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

  let content = fs.readFileSync(filePath, 'utf-8');

  const startMarker = START_MARKER(blockId);
  const endMarker = END_MARKER(blockId);

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return;

  // Remove the delimited block (find the line start before the marker, line end after)
  const lineStartIdx = content.lastIndexOf('\n', startIdx);
  const lineEndIdx = content.indexOf('\n', endIdx + endMarker.length);

  const before = lineStartIdx >= 0 ? content.slice(0, lineStartIdx) : '';
  const after = lineEndIdx >= 0 ? content.slice(lineEndIdx) : '';
  content = before + after;

  // Remove import declarations for the specified module specifiers
  for (const specifier of importModuleSpecifiers) {
    const importRegex = new RegExp(
      `^import\\s+.*from\\s+['"]${escapeRegex(specifier)}['"];?\\s*\\n?`,
      'gm',
    );
    content = content.replace(importRegex, '');
  }

  // Clean up excessive blank lines
  content = content.replace(/\n{3,}/g, '\n\n');
  content = content.trimEnd() + '\n';

  fs.writeFileSync(filePath, content, 'utf-8');
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
  if (startIdx === -1 || endIdx === -1) return content;

  const lineStartIdx = content.lastIndexOf('\n', startIdx);
  const lineEndIdx = content.indexOf('\n', endIdx + endMarker.length);

  const before = lineStartIdx >= 0 ? content.slice(0, lineStartIdx) : '';
  const after = lineEndIdx >= 0 ? content.slice(lineEndIdx) : '';
  content = before + after;

  for (const specifier of importModuleSpecifiers) {
    const importRegex = new RegExp(
      `^import\\s+.*from\\s+['"]${escapeRegex(specifier)}['"];?\\s*\\n?`,
      'gm',
    );
    content = content.replace(importRegex, '');
  }

  content = content.replace(/\n{3,}/g, '\n\n');
  content = content.trimEnd() + '\n';

  return content;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
