'use server';

import * as fs from 'fs/promises';
import * as path from 'path';

// Lista de arquivos e diretórios a serem ignorados
const IGNORE_LIST = [
  'node_modules',
  '.next',
  '.git',
  'apphosting.yaml',
  'INSTRUCOES.md',
  'README.md',
  'package-lock.json',
];

// Lista de extensões de arquivo a serem incluídas
const INCLUDE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.css',
  '.md',
  '.yaml',
  '.yml',
  'firestore.rules',
  '.env'
];

async function getProjectFiles(dir: string, projectRoot: string): Promise<{ path: string; content: string }[]> {
  let results: { path: string; content: string }[] = [];
  const list = await fs.readdir(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    const relativePath = path.relative(projectRoot, filePath);

    if (IGNORE_LIST.some(ignored => relativePath.startsWith(ignored))) {
      continue;
    }

    if (stat && stat.isDirectory()) {
      results = results.concat(await getProjectFiles(filePath, projectRoot));
    } else {
       if (INCLUDE_EXTENSIONS.some(ext => filePath.endsWith(ext)) || IGNORE_LIST.includes(file)) {
         try {
            const content = await fs.readFile(filePath, 'utf-8');
            results.push({ path: relativePath, content });
         } catch (error) {
            console.warn(`Could not read file: ${filePath}`, error);
         }
       }
    }
  }
  return results;
}

export async function getAllProjectCode(): Promise<string> {
  try {
    const projectRoot = process.cwd();
    const allFiles = await getProjectFiles(projectRoot, projectRoot);
    
    // Ordena os arquivos alfabeticamente pelo caminho para consistência
    allFiles.sort((a, b) => a.path.localeCompare(b.path));
    
    let combinedCode = `
# Project: Visualizae
# Full Code Dump
# Generated on: ${new Date().toISOString()}
#
# Este arquivo contém o código-fonte completo de todos os arquivos relevantes do projeto.
# Cada arquivo é delimitado por um cabeçalho no formato:
# // --- FILE: [caminho/do/arquivo] ---
#

`;
    
    for (const file of allFiles) {
      combinedCode += `// --- FILE: ${file.path} ---\n`;
      combinedCode += file.content;
      combinedCode += '\n\n';
    }
    
    return combinedCode;
  } catch (error) {
    console.error("Error reading project files:", error);
    return "Error: Could not read project files. Check server logs for details.";
  }
}
