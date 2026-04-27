type Row = Record<string, unknown>

function getTable(name: string): Row[] {
  try {
    const raw = localStorage.getItem(`mock_db_${name}`)
    return raw ? (JSON.parse(raw) as Row[]) : []
  } catch {
    return []
  }
}

function setTable(name: string, rows: Row[]) {
  localStorage.setItem(`mock_db_${name}`, JSON.stringify(rows))
}

class MockQueryBuilder {
  private _table: string
  private _op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | null = null
  private _payload: Row | Row[] | null = null
  private _upsertOpts: { onConflict?: string } = {}
  private _eqs: Array<[string, unknown]> = []
  private _ins: Array<[string, unknown[]]> = []
  private _orders: Array<[string, boolean]> = []  // [col, ascending]
  private _limitN: number | null = null
  private _isSingle = false
  private _selectAfterMutate = false

  constructor(table: string) {
    this._table = table
  }

  select(_cols = '*') {
    if (this._op === null) {
      this._op = 'select'
    } else {
      // chained after insert/upsert → return the inserted rows
      this._selectAfterMutate = true
    }
    return this
  }

  insert(payload: Row | Row[]) {
    this._op = 'insert'
    this._payload = payload
    return this
  }

  update(payload: Row) {
    this._op = 'update'
    this._payload = payload
    return this
  }

  upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
    this._op = 'upsert'
    this._payload = payload
    this._upsertOpts = opts ?? {}
    return this
  }

  delete() {
    this._op = 'delete'
    return this
  }

  eq(col: string, val: unknown) {
    this._eqs.push([col, val])
    return this
  }

  in(col: string, vals: unknown[]) {
    this._ins.push([col, vals])
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orders.push([col, opts?.ascending ?? true])
    return this
  }

  limit(n: number) {
    this._limitN = n
    return this
  }

  single() {
    this._isSingle = true
    return this
  }

  private _matches(row: Row): boolean {
    for (const [col, val] of this._eqs) {
      if (row[col] !== val) return false
    }
    for (const [col, vals] of this._ins) {
      if (!vals.includes(row[col])) return false
    }
    return true
  }

  private _execute(): { data: unknown; error: { message: string } | null } {
    const rows = getTable(this._table)

    if (this._op === 'select') {
      let result = rows.filter((r) => this._matches(r))
      for (const [col, asc] of this._orders) {
        result = [...result].sort((a, b) => {
          const av = a[col], bv = b[col]
          if (av === bv) return 0
          return (av! < bv! ? -1 : 1) * (asc ? 1 : -1)
        })
      }
      if (this._limitN !== null) result = result.slice(0, this._limitN)
      if (this._isSingle) {
        if (result.length === 0) return { data: null, error: { message: 'No rows found' } }
        return { data: result[0], error: null }
      }
      return { data: result, error: null }
    }

    if (this._op === 'insert') {
      const toInsert = Array.isArray(this._payload) ? this._payload : [this._payload!]
      setTable(this._table, [...rows, ...toInsert])
      if (this._selectAfterMutate) {
        return { data: this._isSingle ? toInsert[0] : toInsert, error: null }
      }
      return { data: null, error: null }
    }

    if (this._op === 'update') {
      const updated = rows.map((r) => (this._matches(r) ? { ...r, ...(this._payload as Row) } : r))
      setTable(this._table, updated)
      return { data: null, error: null }
    }

    if (this._op === 'upsert') {
      const toUpsert = Array.isArray(this._payload) ? this._payload : [this._payload!]
      const key = this._upsertOpts.onConflict ?? 'id'
      const result = [...rows]
      for (const row of toUpsert) {
        const idx = result.findIndex((r) => r[key] === row[key])
        if (idx >= 0) {
          result[idx] = { ...result[idx], ...row }
        } else {
          result.push(row)
        }
      }
      setTable(this._table, result)
      return { data: null, error: null }
    }

    if (this._op === 'delete') {
      setTable(this._table, rows.filter((r) => !this._matches(r)))
      return { data: null, error: null }
    }

    return { data: null, error: null }
  }

  // Makes the builder thenable so it works with await and Promise.all
  then<T1 = { data: unknown; error: { message: string } | null }, T2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return Promise.resolve(this._execute()).then(onfulfilled, onrejected)
  }
}

export function createMockClient() {
  return {
    from(table: string) {
      return new MockQueryBuilder(table)
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signUp: async () => ({ data: null, error: null }),
      signInWithPassword: async () => ({ data: null, error: null }),
      signInWithOAuth: async () => ({ data: null, error: null }),
      signOut: async () => ({ error: null }),
    },
  }
}
