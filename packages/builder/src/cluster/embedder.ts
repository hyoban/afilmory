import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EMBEDDER_DIR = path.resolve(__dirname, '../../../../scripts/clip-embedder')

export interface EmbedRequest {
  paths: string[]
  model?: string
  batch?: number
}

export interface EmbedResult {
  embeddings: Map<string, Float32Array>
  errors: { path: string, error: string }[]
}

function decodeBase64Float32(b64: string): Float32Array {
  const buf = Buffer.from(b64, 'base64')
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice()
}

export async function runEmbedder(req: EmbedRequest): Promise<EmbedResult> {
  const embeddings = new Map<string, Float32Array>()
  const errors: { path: string, error: string }[] = []
  if (req.paths.length === 0) {
    return { embeddings, errors }
  }

  const args = ['run', '--project', EMBEDDER_DIR, 'embed.py']
  if (req.model) {
    args.push('--model', req.model)
  }
  if (req.batch != null) {
    args.push('--batch', String(req.batch))
  }

  const child = spawn('uv', args, { cwd: EMBEDDER_DIR })

  child.stdin.write(`${req.paths.join('\n')}\n`)
  child.stdin.end()

  let stdoutBuf = ''
  let stderrBuf = ''

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  child.stdout.on('data', (chunk: string) => {
    stdoutBuf += chunk
    let nl = stdoutBuf.indexOf('\n')
    while (nl !== -1) {
      const line = stdoutBuf.slice(0, nl).trim()
      stdoutBuf = stdoutBuf.slice(nl + 1)
      if (line) {
        try {
          const rec = JSON.parse(line) as { path: string, embedding: string }
          embeddings.set(rec.path, decodeBase64Float32(rec.embedding))
        }
        catch {
          // ignore malformed line
        }
      }
      nl = stdoutBuf.indexOf('\n')
    }
  })

  child.stderr.on('data', (chunk: string) => {
    stderrBuf += chunk
    let nl = stderrBuf.indexOf('\n')
    while (nl !== -1) {
      const line = stderrBuf.slice(0, nl).trim()
      stderrBuf = stderrBuf.slice(nl + 1)
      if (line) {
        let consumed = false
        try {
          const rec = JSON.parse(line) as {
            path?: string
            error?: string
            event?: string
            device?: string
            model?: string
            count?: number
          }
          if (rec.event === 'ready') {
            process.stderr.write(`[embedder] device=${rec.device} model=${rec.model} count=${rec.count}\n`)
            consumed = true
          }
          else if (rec.path && rec.error) {
            errors.push({ path: rec.path, error: rec.error })
            consumed = true
          }
        }
        catch {
          // not JSON; fall through
        }
        if (!consumed) {
          process.stderr.write(`${line}\n`)
        }
      }
      nl = stderrBuf.indexOf('\n')
    }
  })

  await new Promise<void>((resolve, reject) => {
    child.on('error', (err) => {
      reject(
        new Error(`failed to spawn embedder (uv run): ${err.message}. Did you run 'uv sync' in scripts/clip-embedder?`),
      )
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      }
      else {
        reject(new Error(`embedder exited with code ${code}`))
      }
    })
  })

  return { embeddings, errors }
}
