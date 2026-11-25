import { appendFileSync, closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type State = 'pending' | 'sent' | 'uncertain'

export interface Entry {
  key: string
  hash: string
  state: State
  messageId?: string
  at: number
}

export type Begin =
  | { action: 'send' }
  | { action: 'replay'; entry: Entry }
  | { action: 'blocked'; reason: 'in_flight' | 'ambiguous_delivery' | 'key_reuse'; entry: Entry }

/**
 * Remembers which Idempotency-Keys were handed to SMTP so a repeated request cannot
 * deliver a second copy. State is journaled (append-only JSON lines, fsynced) before the
 * relay talks to SMTP, so a crash mid-send leaves the key `uncertain` instead of unknown.
 * A key that may have been delivered stays blocked until an operator clears it.
 */
export class IdempotencyStore {
  private readonly entries = new Map<string, Entry>()
  private readonly file: string

  constructor(dir: string, private readonly ttlMs = 7 * 24 * 3600 * 1000, private readonly now = () => Date.now()) {
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'journal.jsonl')
    this.load()
  }

  private load() {
    let raw = ''
    try { raw = readFileSync(this.file, 'utf8') } catch (error: any) { if (error.code !== 'ENOENT') throw error }
    for (const line of raw.split('\n')) {
      if (!line) continue
      let item: any
      try { item = JSON.parse(line) } catch { continue } // a torn final line from a crash
      if (item.deleted) this.entries.delete(item.key)
      else this.entries.set(item.key, item)
    }
    const cutoff = this.now() - this.ttlMs
    for (const [key, entry] of this.entries) {
      if (entry.at < cutoff) this.entries.delete(key)
      else if (entry.state === 'pending') this.entries.set(key, { ...entry, state: 'uncertain', at: this.now() }) // crashed mid-send
    }
    this.compact()
  }

  private compact() {
    const temporary = `${this.file}.tmp`
    writeFileSync(temporary, [...this.entries.values()].map(e => JSON.stringify(e) + '\n').join(''), { mode: 0o600 })
    const fd = openSync(temporary, 'r+')
    fsyncSync(fd)
    closeSync(fd)
    renameSync(temporary, this.file)
  }

  private append(record: object) {
    const fd = openSync(this.file, 'a', 0o600)
    try {
      appendFileSync(fd, JSON.stringify(record) + '\n')
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
  }

  private put(entry: Entry) {
    this.append(entry) // throws on a full or unwritable disk, which fails the request before any send
    this.entries.set(entry.key, entry)
  }

  get(key: string): Entry | undefined {
    return this.entries.get(key)
  }

  begin(key: string, hash: string): Begin {
    const existing = this.entries.get(key)
    if (existing && existing.at < this.now() - this.ttlMs) {
      this.entries.delete(key)
    } else if (existing) {
      if (existing.hash !== hash) return { action: 'blocked', reason: 'key_reuse', entry: existing }
      if (existing.state === 'sent') return { action: 'replay', entry: existing }
      return { action: 'blocked', reason: existing.state === 'pending' ? 'in_flight' : 'ambiguous_delivery', entry: existing }
    }
    this.put({ key, hash, state: 'pending', at: this.now() })
    return { action: 'send' }
  }

  markSent(key: string, messageId: string) {
    const entry = this.entries.get(key)
    if (entry) this.put({ ...entry, state: 'sent', messageId, at: this.now() })
  }

  markUncertain(key: string) {
    const entry = this.entries.get(key)
    if (entry) this.put({ ...entry, state: 'uncertain', at: this.now() })
  }

  /** The server explicitly refused the message, so nothing was delivered and a retry is safe. */
  release(key: string) {
    if (this.entries.delete(key)) this.append({ key, deleted: true })
  }

  /** Operator reconciliation: allow a resend of a key stuck in `uncertain`. */
  clearUncertain(key: string): boolean {
    if (this.entries.get(key)?.state !== 'uncertain') return false
    this.release(key)
    return true
  }
}
