import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import os from 'node:os'
import { exec } from 'node:child_process'
import crypto from 'node:crypto'
import type { Plugin } from 'vite'

interface RysIndexNoteMeta {
  id?: string
  pinned?: boolean
  trashed?: boolean
  trashedFrom?: string
  createdAt?: number
  updatedAt?: number
}

interface RysIndexFile {
  version: number
  notes: Record<string, RysIndexNoteMeta>
}

const LEGACY_SESSION_VAULT = path.join(os.homedir(), 'Documentos', 'RysNotes')
const DEFAULT_VAULT = fsSync.existsSync(LEGACY_SESSION_VAULT)
  ? LEGACY_SESSION_VAULT
  : path.join(os.homedir(), 'Documentos', 'RYS MD')

const WELCOME_NOTE_CONTENT = `# Bem-vindo ao Rys MD ✨

O **Rys MD** une a organização elegante e instantânea do **Apple Notes** com o poderoso editor Markdown Dual-Mode do **Orca ADE**, rodando nativamente no seu Ubuntu com motor **Rust**.

---

## 🚀 Superpoderes do Editor (Orca ADE Engine)

Experimente digitar \`/\` em qualquer linha vazia para abrir o **Menu de Comandos Slash**, ou alterne entre o modo **Rich (WYSIWYG)** e **Source (Markdown cru)** no canto superior direito!

### 1. Checklists Interativos
- [x] Arquitetura híbrida Rust + Tiptap v3 (\`@tiptap/markdown\`)
- [x] Layout de 3 colunas estilo Apple Notes com notas fixadas e busca instantânea
- [ ] Pressione \`/\` e escolha **Check List** ou **Table** para testar
- [ ] Cole uma imagem da área de transferência (\`Ctrl+V\`) direto na nota

### 2. Blocos Retráteis (Toggle Sections)
<details class="orca-details" data-orca-toggle="heading-3" open>
<summary>Clique para expandir/recolher esta seção</summary>

Você pode criar blocos retráteis normais ou com títulos H1–H5 usando o comando \`/toggle\`! Tudo é salvo como Markdown/HTML limpo no seu disco.

</details>

### 3. Blocos de Código com Syntax Highlighting
\`\`\`rust
// Motor nativo em Rust sincronizando seus arquivos .md em tempo real
pub fn welcome_to_rys_md(user: &str) -> String {
    format!("Olá, {}! Suas notas estão salvas em ~/Documentos/RysNotes", user)
}
\`\`\`

### 4. Diagramas Mermaid ao Vivo
Edite o código abaixo e veja o diagrama atualizar em tempo real:

\`\`\`mermaid
graph LR
  A[Apple Notes UX] --> C[Rys MD]
  B[Orca ADE Editor] --> C
  C --> D[Arquivos .md Locais]
  C --> E[Rust Ultrarrápido]
\`\`\`

### 5. Tabelas GFM Interativas
Passe o mouse sobre as células para adicionar/remover linhas e colunas:

| Recurso | Atalho / Comando | Status |
| :--- | :--- | :--- |
| Nova Nota | \`Ctrl + N\` | Ativo |
| Busca Global | \`Ctrl + F\` / \`Ctrl + K\` | Ativo |
| Modo Foco | \`Ctrl + \\\` | Ativo |
| Menu de Blocos | Digite \`/\` no início da linha | Ativo |
| Inserir Link | \`Ctrl + K\` no texto | Ativo |

### 6. Matemática LaTeX (KaTeX)
Fórmulas inline como $E = mc^2$ ou blocos matemáticos completos via \`/math-block\`:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

---

#bem-vindo #rys-md #orca #ubuntu
`

const SECOND_NOTE_CONTENT = `# Ideias & Projetos Pessoais 💡

Use pastas na barra lateral esquerda ou adicione tags como #projetos e #ideias em qualquer lugar do texto para filtrar rapidamente.

## Próximos Passos
1. Testar o **Modo Foco** clicando no ícone de expandir no topo (ou \`Ctrl + \\\`).
2. Fixar notas importantes no topo clicando no ícone de **Alfinete** 📌.
3. Alternar entre **Dark Mode** e **Light Mode** no rodapé da barra lateral.

> Dica: A primeira linha da sua nota define automaticamente o nome do arquivo \`.md\` na pasta \`~/Documentos/RysNotes\`!
`

async function ensureVaultInitialized(vaultPath: string): Promise<void> {
  await fs.mkdir(vaultPath, { recursive: true })
  await fs.mkdir(path.join(vaultPath, 'assets'), { recursive: true })
  await fs.mkdir(path.join(vaultPath, '.trash'), { recursive: true })

  const indexPath = path.join(vaultPath, '.rys-index.json')
  if (!fsSync.existsSync(indexPath)) {
    const entries = await fs.readdir(vaultPath)
    const mdFiles = entries.filter((e) => e.endsWith('.md'))
    const now = Date.now()
    const indexData: RysIndexFile = { version: 1, notes: {} }

    if (mdFiles.length === 0) {
      await fs.mkdir(path.join(vaultPath, 'Pessoal'), { recursive: true })
      await fs.mkdir(path.join(vaultPath, 'Trabalho'), { recursive: true })
      const welcomeRel = 'Bem-vindo ao Rys MD ✨.md'
      const ideasRel = 'Pessoal/Ideias & Projetos Pessoais 💡.md'
      await fs.writeFile(path.join(vaultPath, welcomeRel), WELCOME_NOTE_CONTENT, 'utf8')
      await fs.writeFile(path.join(vaultPath, ideasRel), SECOND_NOTE_CONTENT, 'utf8')
      indexData.notes[welcomeRel] = { pinned: true, createdAt: now, updatedAt: now }
      indexData.notes[ideasRel] = { pinned: false, createdAt: now - 3600_000, updatedAt: now - 3600_000 }
    }
    await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2), 'utf8')
  }
}

async function readIndex(vaultPath: string): Promise<RysIndexFile> {
  const indexPath = path.join(vaultPath, '.rys-index.json')
  try {
    const raw = await fs.readFile(indexPath, 'utf8')
    return JSON.parse(raw) as RysIndexFile
  } catch {
    return { version: 1, notes: {} }
  }
}

async function writeIndex(vaultPath: string, index: RysIndexFile): Promise<void> {
  const indexPath = path.join(vaultPath, '.rys-index.json')
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8')
}

function extractTitleAndPreview(content: string, fallbackName: string) {
  const lines = content.split(/\r?\n/)
  let title = ''
  let preview = ''
  const tags = new Set<string>()

  // Match #tag in content (excluding headings like `# Title`)
  const tagMatches = content.matchAll(/(?:^|\s)#([a-zA-Z0-9_\u00C0-\u00FF-]{2,32})/g)
  for (const m of tagMatches) {
    if (m[1]) tags.add(m[1].toLowerCase())
  }

  let inFence = false
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence || !line) continue
    if (!title) {
      title = line.replace(/^#{1,6}\s+/, '').replace(/[*_`~]/g, '').trim()
      continue
    }
    if (!preview && !line.startsWith('<details') && !line.startsWith('</details') && !line.startsWith('<summary') && !line.startsWith('---')) {
      preview = line
        .replace(/^#{1,6}\s+/, '')
        .replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/[*_`~>|]/g, '')
        .trim()
    }
  }

  return {
    title: title || fallbackName,
    preview: preview || 'Sem texto adicional',
    tags: Array.from(tags)
  }
}

async function scanVault(vaultPath: string) {
  await ensureVaultInitialized(vaultPath)
  const index = await readIndex(vaultPath)
  const folders: string[] = []
  const notes: Array<{
    id: string
    relativePath: string
    folder: string
    title: string
    preview: string
    content: string
    tags: string[]
    pinned: boolean
    trashed: boolean
    createdAt: number
    updatedAt: number
  }> = []

  async function walk(currentDir: string, relDir: string, isTrash = false) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.trash') continue
      if (entry.name === 'assets' && relDir === '') continue

      const absPath = path.join(currentDir, entry.name)
      const entryRelPath = relDir ? `${relDir}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        if (entry.name === '.trash' && relDir === '') {
          await walk(absPath, '.trash', true)
        } else if (!isTrash) {
          folders.push(entryRelPath)
          await walk(absPath, entryRelPath, false)
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const stat = await fs.stat(absPath)
        const content = await fs.readFile(absPath, 'utf8')
        const fallbackName = path.basename(entry.name, '.md')
        const { title, preview, tags } = extractTitleAndPreview(content, fallbackName)
        const meta = index.notes[entryRelPath] ?? {}
        if (!meta.id) {
          meta.id = crypto.randomUUID()
          meta.createdAt = meta.createdAt ?? stat.birthtimeMs ?? stat.mtimeMs
          meta.updatedAt = meta.updatedAt ?? stat.mtimeMs
          index.notes[entryRelPath] = meta
          indexDirty = true
        }
        const folder = isTrash ? '.trash' : relDir

        notes.push({
          id: meta.id,
          relativePath: entryRelPath,
          folder,
          title,
          preview,
          content,
          tags,
          pinned: Boolean(meta.pinned) && !isTrash,
          trashed: isTrash || Boolean(meta.trashed),
          createdAt: meta.createdAt ?? stat.birthtimeMs ?? stat.mtimeMs,
          updatedAt: meta.updatedAt ?? stat.mtimeMs
        })
      }
    }
  }

  let indexDirty = false
  await walk(vaultPath, '', false)
  if (indexDirty) {
    await writeIndex(vaultPath, index)
  }
  folders.sort((a, b) => a.localeCompare(b))
  notes.sort((a, b) => b.updatedAt - a.updatedAt)

  return { vaultPath, folders, notes }
}

function sanitizeFileName(rawTitle: string): string {
  const cleaned = rawTitle
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return cleaned || 'Nova Nota'
}

const EXTERNAL_FAVICON_PATH = '/home/simao/Documentos/RYS DEV/RYS DEV Tmp/favicon.ico'
const EXTERNAL_LOGO_TEXT_PATH =
  '/home/simao/Área de Trabalho/🧹 tmp_ERASER/RYS MD tmp/Texto_Rys_MD.png'

function syncBrandAssetsToPublic(): void {
  try {
    const pubDir = path.resolve(__dirname, 'public')
    fsSync.mkdirSync(pubDir, { recursive: true })
    if (fsSync.existsSync(EXTERNAL_FAVICON_PATH)) {
      fsSync.copyFileSync(EXTERNAL_FAVICON_PATH, path.join(pubDir, 'favicon.ico'))
    }
    if (fsSync.existsSync(EXTERNAL_LOGO_TEXT_PATH)) {
      fsSync.copyFileSync(EXTERNAL_LOGO_TEXT_PATH, path.join(pubDir, 'Texto_Rys_MD.png'))
    }
  } catch {
    // ignore
  }
}

function rysVaultDevApiPlugin(): Plugin {
  syncBrandAssetsToPublic()
  return {
    name: 'rys-vault-dev-api',
    configureServer(server) {
      syncBrandAssetsToPublic()
      server.middlewares.use(async (req, res, next) => {
        const reqUrl = new URL(req.url || '/', 'http://localhost')

        if (req.method === 'GET' && reqUrl.pathname === '/favicon.ico') {
          const target = fsSync.existsSync(EXTERNAL_FAVICON_PATH)
            ? EXTERNAL_FAVICON_PATH
            : path.resolve(__dirname, 'public/favicon.ico')
          if (fsSync.existsSync(target)) {
            const buf = await fs.readFile(target)
            res.setHeader('Content-Type', 'image/x-icon')
            res.setHeader('Cache-Control', 'no-cache')
            res.end(buf)
            return
          }
        }

        if (req.method === 'GET' && reqUrl.pathname === '/Texto_Rys_MD.png') {
          const target = fsSync.existsSync(EXTERNAL_LOGO_TEXT_PATH)
            ? EXTERNAL_LOGO_TEXT_PATH
            : path.resolve(__dirname, 'public/Texto_Rys_MD.png')
          if (fsSync.existsSync(target)) {
            const buf = await fs.readFile(target)
            res.setHeader('Content-Type', 'image/png')
            res.setHeader('Cache-Control', 'no-cache')
            res.end(buf)
            return
          }
        }

        if (!req.url?.startsWith('/api/vault')) {
          return next()
        }

        const url = reqUrl
        res.setHeader('Content-Type', 'application/json')

        try {
          if (req.method === 'GET' && url.pathname === '/api/vault/asset') {
            const vaultPath = url.searchParams.get('vaultPath') || DEFAULT_VAULT
            const relPath = url.searchParams.get('path') || ''
            const absPath = path.resolve(vaultPath, relPath)
            if (!absPath.startsWith(path.resolve(vaultPath))) {
              res.statusCode = 403
              res.end('Forbidden')
              return
            }
            const ext = path.extname(absPath).toLowerCase()
            const mime =
              ext === '.png'
                ? 'image/png'
                : ext === '.jpg' || ext === '.jpeg'
                  ? 'image/jpeg'
                  : ext === '.gif'
                    ? 'image/gif'
                    : ext === '.webp'
                      ? 'image/webp'
                      : ext === '.svg'
                        ? 'image/svg+xml'
                        : 'application/octet-stream'
            res.setHeader('Content-Type', mime)
            const data = await fs.readFile(absPath)
            res.end(data)
            return
          }

          let body: Record<string, any> = {}
          if (req.method === 'POST') {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(Buffer.from(chunk))
            }
            const raw = Buffer.concat(chunks).toString('utf8')
            if (raw) body = JSON.parse(raw)
          }

          const vaultPath: string = body.vaultPath || url.searchParams.get('vaultPath') || DEFAULT_VAULT

          if (url.pathname === '/api/vault/scan') {
            const result = await scanVault(vaultPath)
            res.end(JSON.stringify(result))
            return
          }

          if (url.pathname === '/api/vault/save-note') {
            const { relativePath, content, autoRename = true } = body
            const absPath = path.join(vaultPath, relativePath)
            await fs.mkdir(path.dirname(absPath), { recursive: true })
            await fs.writeFile(absPath, content, 'utf8')

            const index = await readIndex(vaultPath)
            const now = Date.now()
            const prevMeta = index.notes[relativePath] ?? { createdAt: now }
            let finalRelPath: string = relativePath

            if (autoRename && !relativePath.startsWith('.trash/')) {
              const fallback = path.basename(relativePath, '.md')
              const { title } = extractTitleAndPreview(content, fallback)
              const desiredBase = sanitizeFileName(title)
              const currentDir = path.dirname(relativePath) === '.' ? '' : path.dirname(relativePath)
              const candidateRel = currentDir ? `${currentDir}/${desiredBase}.md` : `${desiredBase}.md`

              if (candidateRel !== relativePath) {
                let uniqueRel = candidateRel
                let counter = 2
                while (
                  uniqueRel !== relativePath &&
                  fsSync.existsSync(path.join(vaultPath, uniqueRel))
                ) {
                  uniqueRel = currentDir
                    ? `${currentDir}/${desiredBase} (${counter}).md`
                    : `${desiredBase} (${counter}).md`
                  counter++
                }
                if (uniqueRel !== relativePath) {
                  await fs.rename(absPath, path.join(vaultPath, uniqueRel))
                  delete index.notes[relativePath]
                  finalRelPath = uniqueRel
                }
              }
            }

            index.notes[finalRelPath] = {
              ...prevMeta,
              updatedAt: now
            }
            await writeIndex(vaultPath, index)
            const state = await scanVault(vaultPath)
            res.end(JSON.stringify({ finalRelativePath: finalRelPath, state }))
            return
          }

          if (url.pathname === '/api/vault/create-note') {
            const { folder = '', initialContent = '# Nova Nota\n\n' } = body
            const baseName = 'Nova Nota'
            let relPath = folder ? `${folder}/${baseName}.md` : `${baseName}.md`
            let counter = 2
            while (fsSync.existsSync(path.join(vaultPath, relPath))) {
              relPath = folder
                ? `${folder}/${baseName} (${counter}).md`
                : `${baseName} (${counter}).md`
              counter++
            }
            const absPath = path.join(vaultPath, relPath)
            await fs.mkdir(path.dirname(absPath), { recursive: true })
            await fs.writeFile(absPath, initialContent, 'utf8')

            const index = await readIndex(vaultPath)
            const now = Date.now()
            index.notes[relPath] = { pinned: false, createdAt: now, updatedAt: now }
            await writeIndex(vaultPath, index)

            const state = await scanVault(vaultPath)
            res.end(JSON.stringify({ createdRelativePath: relPath, state }))
            return
          }

          if (url.pathname === '/api/vault/toggle-pin') {
            const { relativePath } = body
            const index = await readIndex(vaultPath)
            const current = index.notes[relativePath] ?? {}
            index.notes[relativePath] = {
              ...current,
              pinned: !current.pinned
            }
            await writeIndex(vaultPath, index)
            const state = await scanVault(vaultPath)
            res.end(JSON.stringify({ state }))
            return
          }

          if (url.pathname === '/api/vault/trash-note') {
            const { relativePath } = body
            const index = await readIndex(vaultPath)
            if (relativePath.startsWith('.trash/')) {
              // Permanent delete
              await fs.unlink(path.join(vaultPath, relativePath)).catch(() => {})
              delete index.notes[relativePath]
            } else {
              await fs.mkdir(path.join(vaultPath, '.trash'), { recursive: true })
              const base = path.basename(relativePath, '.md')
              let trashRel = `.trash/${base}.md`
              let counter = 2
              while (fsSync.existsSync(path.join(vaultPath, trashRel))) {
                trashRel = `.trash/${base} (${counter}).md`
                counter++
              }
              await fs.rename(path.join(vaultPath, relativePath), path.join(vaultPath, trashRel))
              const meta = index.notes[relativePath] ?? {}
              delete index.notes[relativePath]
              index.notes[trashRel] = {
                ...meta,
                pinned: false,
                trashed: true,
                trashedFrom: relativePath,
                updatedAt: Date.now()
              }
            }
            await writeIndex(vaultPath, index)
            const state = await scanVault(vaultPath)
            res.end(JSON.stringify({ state }))
            return
          }

          if (url.pathname === '/api/vault/restore-note') {
            const { relativePath } = body
            const index = await readIndex(vaultPath)
            const meta = index.notes[relativePath] ?? {}
            const originalRel = meta.trashedFrom || path.basename(relativePath)
            let targetRel = originalRel
            const targetDir = path.dirname(targetRel) === '.' ? '' : path.dirname(targetRel)
            const base = path.basename(targetRel, '.md')
            let counter = 2
            while (fsSync.existsSync(path.join(vaultPath, targetRel))) {
              targetRel = targetDir ? `${targetDir}/${base} (${counter}).md` : `${base} (${counter}).md`
              counter++
            }
            await fs.mkdir(path.dirname(path.join(vaultPath, targetRel)), { recursive: true })
            await fs.rename(path.join(vaultPath, relativePath), path.join(vaultPath, targetRel))
            delete index.notes[relativePath]
            index.notes[targetRel] = {
              ...meta,
              trashed: false,
              trashedFrom: undefined,
              updatedAt: Date.now()
            }
            await writeIndex(vaultPath, index)
            const state = await scanVault(vaultPath)
            res.end(JSON.stringify({ restoredRelativePath: targetRel, state }))
            return
          }

          if (url.pathname === '/api/vault/move-note') {
            const { relativePath, targetFolder } = body
            const base = path.basename(relativePath, '.md')
            let nextRel = targetFolder ? `${targetFolder}/${base}.md` : `${base}.md`
            if (nextRel !== relativePath) {
              let counter = 2
              while (fsSync.existsSync(path.join(vaultPath, nextRel))) {
                nextRel = targetFolder
                  ? `${targetFolder}/${base} (${counter}).md`
                  : `${base} (${counter}).md`
                counter++
              }
              await fs.mkdir(path.dirname(path.join(vaultPath, nextRel)), { recursive: true })
              await fs.rename(path.join(vaultPath, relativePath), path.join(vaultPath, nextRel))
              const index = await readIndex(vaultPath)
              const meta = index.notes[relativePath] ?? {}
              delete index.notes[relativePath]
              index.notes[nextRel] = { ...meta, updatedAt: Date.now() }
              await writeIndex(vaultPath, index)
            }
            const state = await scanVault(vaultPath)
            res.end(JSON.stringify({ movedRelativePath: nextRel, state }))
            return
          }

          if (url.pathname === '/api/vault/create-folder') {
            const { folderPath } = body
            const cleaned = folderPath
              .split('/')
              .map((p: string) => sanitizeFileName(p))
              .filter(Boolean)
              .join('/')
            if (cleaned) {
              await fs.mkdir(path.join(vaultPath, cleaned), { recursive: true })
            }
            const state = await scanVault(vaultPath)
            res.end(JSON.stringify({ createdFolder: cleaned, state }))
            return
          }

          if (url.pathname === '/api/vault/delete-folder') {
            const { folderPath } = body
            const absFolder = path.join(vaultPath, folderPath)
            await fs.rm(absFolder, { recursive: true, force: true })
            const state = await scanVault(vaultPath)
            res.end(JSON.stringify({ state }))
            return
          }

          if (url.pathname === '/api/vault/save-asset') {
            const { fileName, base64Data } = body
            const ext = path.extname(fileName || 'image.png') || '.png'
            const stamp = `img-${Date.now()}${ext}`
            const assetsDir = path.join(vaultPath, 'assets')
            await fs.mkdir(assetsDir, { recursive: true })
            const absAsset = path.join(assetsDir, stamp)
            const cleanedBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '')
            await fs.writeFile(absAsset, Buffer.from(cleanedBase64, 'base64'))
            res.end(JSON.stringify({ relativeAssetPath: `assets/${stamp}` }))
            return
          }

          if (url.pathname === '/api/vault/reveal-in-folder') {
            const { relativePath } = body
            const target = relativePath ? path.join(vaultPath, relativePath) : vaultPath
            const dir = fsSync.existsSync(target) && fsSync.statSync(target).isDirectory()
              ? target
              : path.dirname(target)
            exec(`xdg-open "${dir}"`)
            res.end(JSON.stringify({ ok: true }))
            return
          }

          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Not found' }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), rysVaultDevApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  }
})
