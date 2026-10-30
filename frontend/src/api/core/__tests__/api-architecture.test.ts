import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const sourceRoot = path.resolve(process.cwd(), 'src')

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return []
      return sourceFiles(fullPath)
    }
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')
      ? [fullPath]
      : []
  })
}

describe('frontend API architecture', () => {
  it('keeps active Hub and auth-backend HTTP calls inside src/api clients', () => {
    const violations: string[] = []

    for (const file of sourceFiles(sourceRoot)) {
      if (file.startsWith(path.join(sourceRoot, 'api') + path.sep)) continue
      const relativeFile = path.relative(sourceRoot, file).replaceAll('\\', '/')

      const source = fs.readFileSync(file, 'utf8')
      const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const expression = node.expression
          const isFetch = ts.isIdentifier(expression) && expression.text === 'fetch'
          const isAxiosMethod = ts.isPropertyAccessExpression(expression)
            && ts.isIdentifier(expression.expression)
            && expression.expression.text === 'axios'
            && ['get', 'post', 'put', 'patch', 'delete', 'request'].includes(expression.name.text)

          if ((isFetch || isAxiosMethod) && node.arguments[0]) {
            const target = node.arguments[0].getText(parsed)
            const isHealthProbe = relativeFile === 'lib/network.ts' && target.includes('/api/health')
            if (!isHealthProbe && (target.includes('/api/') || target.includes('/login-auth/'))) {
              const line = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1
              violations.push(`${relativeFile}:${line} -> ${target}`)
            }
          }
        }
        ts.forEachChild(node, visit)
      }

      visit(parsed)
    }

    expect(violations, violations.join('\n')).toEqual([])
  })
})
