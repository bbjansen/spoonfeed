import { Project, SyntaxKind, type ObjectLiteralExpression } from 'ts-morph';

/**
 * Adds a module import to app.module.ts:
 * 1. Adds an import declaration at the top of the file
 * 2. Adds the module name to the @Module({ imports: [...] }) array
 *
 * Idempotent: skips if the import path already exists.
 */
export function addModuleImport(filePath: string, moduleName: string, importPath: string): void {
  const project = new Project({ useInMemoryFileSystem: false });
  const sourceFile = project.addSourceFileAtPath(filePath);

  // Guard: skip if import already exists
  const existing = sourceFile.getImportDeclaration(
    (decl) => decl.getModuleSpecifierValue() === importPath,
  );
  if (existing) return;

  // Add import declaration
  sourceFile.addImportDeclaration({
    namedImports: [moduleName],
    moduleSpecifier: importPath,
  });

  // Find the AppModule class and its @Module decorator
  const appModuleClass = sourceFile.getClasses().find((c) => c.getDecorator('Module'));
  if (!appModuleClass) {
    throw new Error('No class with @Module decorator found');
  }

  const moduleDecorator = appModuleClass.getDecorator('Module')!;
  const args = moduleDecorator.getArguments();
  if (args.length === 0) {
    throw new Error('@Module decorator has no arguments');
  }

  const objectLiteral = args[0] as ObjectLiteralExpression;
  const importsProp = objectLiteral.getProperty('imports');

  if (importsProp) {
    // Append to existing imports array
    const initializer = importsProp
      .asKindOrThrow(SyntaxKind.PropertyAssignment)
      .getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression);
    initializer.addElement(moduleName);
  } else {
    // Create imports property with array if it doesn't exist
    objectLiteral.addPropertyAssignment({
      name: 'imports',
      initializer: `[${moduleName}]`,
    });
  }

  sourceFile.formatText();
  sourceFile.saveSync();
}

/**
 * Adds a module import to an app.module.ts source string (in-memory, no filesystem access).
 * Returns the transformed source text.
 */
export function addModuleImportToString(
  source: string,
  moduleName: string,
  importPath: string,
): string {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('app.module.ts', source);

  // Guard: skip if import already exists
  const existing = sourceFile.getImportDeclaration(
    (decl) => decl.getModuleSpecifierValue() === importPath,
  );
  if (existing) return sourceFile.getFullText();

  // Add import declaration
  sourceFile.addImportDeclaration({
    namedImports: [moduleName],
    moduleSpecifier: importPath,
  });

  // Find the AppModule class and its @Module decorator
  const appModuleClass = sourceFile.getClasses().find((c) => c.getDecorator('Module'));
  if (!appModuleClass) {
    throw new Error('No class with @Module decorator found');
  }

  const moduleDecorator = appModuleClass.getDecorator('Module')!;
  const args = moduleDecorator.getArguments();
  if (args.length === 0) {
    throw new Error('@Module decorator has no arguments');
  }

  const objectLiteral = args[0] as ObjectLiteralExpression;
  const importsProp = objectLiteral.getProperty('imports');

  if (importsProp) {
    const initializer = importsProp
      .asKindOrThrow(SyntaxKind.PropertyAssignment)
      .getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression);
    initializer.addElement(moduleName);
  } else {
    objectLiteral.addPropertyAssignment({
      name: 'imports',
      initializer: `[${moduleName}]`,
    });
  }

  sourceFile.formatText();
  return sourceFile.getFullText();
}

/**
 * Removes a module import from app.module.ts:
 * 1. Removes the import declaration matching the import path
 * 2. Removes the module name from the @Module({ imports: [...] }) array
 *
 * No-op if the import is not present.
 */
export function removeModuleImport(filePath: string, moduleName: string, importPath: string): void {
  const project = new Project({ useInMemoryFileSystem: false });
  const sourceFile = project.addSourceFileAtPath(filePath);

  // Check if import declaration exists — if not, nothing to do
  const importDecl = sourceFile.getImportDeclaration(
    (decl) => decl.getModuleSpecifierValue() === importPath,
  );
  if (!importDecl) return;

  // Remove import declaration
  importDecl.remove();

  // Remove from @Module imports array
  const appModuleClass = sourceFile.getClasses().find((c) => c.getDecorator('Module'));
  if (!appModuleClass) return;

  const moduleDecorator = appModuleClass.getDecorator('Module')!;
  const args = moduleDecorator.getArguments();
  if (args.length === 0) return;

  const objectLiteral = args[0] as ObjectLiteralExpression;
  const importsProp = objectLiteral.getProperty('imports');
  if (!importsProp) return;

  const initializer = importsProp
    .asKindOrThrow(SyntaxKind.PropertyAssignment)
    .getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
  if (!initializer) return;

  const elementIndex = initializer.getElements().findIndex((e) => e.getText() === moduleName);
  if (elementIndex >= 0) {
    initializer.removeElement(elementIndex);
  }

  sourceFile.formatText();
  sourceFile.saveSync();
}

/**
 * Removes a module import from an app.module.ts source string (in-memory, no filesystem access).
 * Returns the transformed source text.
 */
export function removeModuleImportFromString(
  source: string,
  moduleName: string,
  importPath: string,
): string {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('app.module.ts', source);

  const importDecl = sourceFile.getImportDeclaration(
    (decl) => decl.getModuleSpecifierValue() === importPath,
  );
  if (!importDecl) return sourceFile.getFullText();

  importDecl.remove();

  const appModuleClass = sourceFile.getClasses().find((c) => c.getDecorator('Module'));
  if (!appModuleClass) return sourceFile.getFullText();

  const moduleDecorator = appModuleClass.getDecorator('Module')!;
  const args = moduleDecorator.getArguments();
  if (args.length === 0) return sourceFile.getFullText();

  const objectLiteral = args[0] as ObjectLiteralExpression;
  const importsProp = objectLiteral.getProperty('imports');
  if (!importsProp) return sourceFile.getFullText();

  const initializer = importsProp
    .asKindOrThrow(SyntaxKind.PropertyAssignment)
    .getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
  if (!initializer) return sourceFile.getFullText();

  const elementIndex = initializer.getElements().findIndex((e) => e.getText() === moduleName);
  if (elementIndex >= 0) {
    initializer.removeElement(elementIndex);
  }

  sourceFile.formatText();
  return sourceFile.getFullText();
}
