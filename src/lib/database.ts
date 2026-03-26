import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import type { Product, Category, LabelTemplate, PrintHistory, InventoryMovement, AppSetting } from '@/types'

const DB_NAME = 'labelcraft_pro_db'
const DB_STORE = 'sqlitedb'
const DB_KEY = 'main'

class DatabaseManager {
  private database: SqlJsDatabase | null = null
  private saveTimeout: ReturnType<typeof setTimeout> | null = null

  async init(): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    })

    const savedData = await this.loadFromIndexedDB()
    if (savedData) {
      this.database = new SQL.Database(new Uint8Array(savedData))
    } else {
      this.database = new SQL.Database()
    }

    this.runMigrations()
    await this.persistToIndexedDB()
  }

  private get db(): SqlJsDatabase {
    if (!this.database) throw new Error('Base de datos no inicializada. Llama a init() primero.')
    return this.database
  }

  // === IndexedDB persistence ===

  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(DB_STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('No se pudo abrir IndexedDB'))
    })
  }

  private async loadFromIndexedDB(): Promise<ArrayBuffer | null> {
    try {
      const idb = await this.openIndexedDB()
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(DB_STORE, 'readonly')
        const store = tx.objectStore(DB_STORE)
        const request = store.get(DB_KEY)
        request.onsuccess = () => resolve(request.result ?? null)
        request.onerror = () => reject(new Error('Error leyendo de IndexedDB'))
      })
    } catch {
      return null
    }
  }

  private async persistToIndexedDB(): Promise<void> {
    const data = this.db.export()
    const idb = await this.openIndexedDB()
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(DB_STORE, 'readwrite')
      const store = tx.objectStore(DB_STORE)
      const request = store.put(data.buffer, DB_KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Error guardando en IndexedDB'))
    })
  }

  private scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(() => {
      this.persistToIndexedDB()
    }, 500)
  }

  // === Migrations ===

  private runMigrations(): void {
    this.db.run(`CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )`)

    const applied = this.db.exec('SELECT version FROM _migrations ORDER BY version')
    const appliedVersions = new Set(
      applied.length > 0 ? applied[0].values.map((r) => r[0] as number) : []
    )

    const migrations: Array<{ version: number; name: string; sql: string }> = [
      {
        version: 1,
        name: 'initial_schema',
        sql: `
          CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#C47A3A',
            icon TEXT DEFAULT 'tag',
            created_at TEXT DEFAULT (datetime('now'))
          );

          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            sku TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
            price REAL DEFAULT 0,
            cost REAL DEFAULT 0,
            stock_quantity INTEGER DEFAULT 0,
            min_stock_alert INTEGER DEFAULT 5,
            barcode_value TEXT,
            barcode_type TEXT DEFAULT 'code128',
            unit TEXT DEFAULT 'unidad',
            image_blob TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );

          CREATE TABLE IF NOT EXISTS label_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            width_mm REAL NOT NULL DEFAULT 50,
            height_mm REAL NOT NULL DEFAULT 30,
            canvas_json TEXT NOT NULL DEFAULT '{"elements":[],"width":50,"height":30,"backgroundColor":"#FFFFFF"}',
            is_default INTEGER DEFAULT 0,
            paper_size TEXT DEFAULT 'custom',
            columns INTEGER DEFAULT 1,
            rows INTEGER DEFAULT 1,
            margin_top_mm REAL DEFAULT 5,
            margin_left_mm REAL DEFAULT 5,
            gap_x_mm REAL DEFAULT 2,
            gap_y_mm REAL DEFAULT 2,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );

          CREATE TABLE IF NOT EXISTS print_history (
            id TEXT PRIMARY KEY,
            template_id TEXT REFERENCES label_templates(id) ON DELETE SET NULL,
            product_ids TEXT NOT NULL DEFAULT '[]',
            quantity INTEGER NOT NULL DEFAULT 0,
            printed_at TEXT DEFAULT (datetime('now')),
            status TEXT DEFAULT 'completed'
          );

          CREATE TABLE IF NOT EXISTS inventory_movements (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            reason TEXT,
            reference TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          );

          CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
          );

          CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
          CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode_value);
          CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
          CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
          CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
          CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(created_at);
          CREATE INDEX IF NOT EXISTS idx_print_history_date ON print_history(printed_at);
        `,
      },
    ]

    for (const migration of migrations) {
      if (!appliedVersions.has(migration.version)) {
        this.db.run(migration.sql)
        this.db.run('INSERT INTO _migrations (version, name) VALUES (?, ?)', [
          migration.version,
          migration.name,
        ])
      }
    }
  }

  // === Helpers ===

  private generateId(): string {
    return crypto.randomUUID()
  }

  private now(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19)
  }

  private queryOne<T>(sql: string, params: unknown[] = []): T | null {
    const stmt = this.db.prepare(sql)
    stmt.bind(params)
    if (stmt.step()) {
      const row = stmt.getAsObject() as T
      stmt.free()
      return row
    }
    stmt.free()
    return null
  }

  private queryAll<T>(sql: string, params: unknown[] = []): T[] {
    const result = this.db.exec(sql, params)
    if (result.length === 0) return []
    const { columns, values } = result[0]
    return values.map((row) => {
      const obj: Record<string, unknown> = {}
      columns.forEach((col, i) => {
        obj[col] = row[i]
      })
      return obj as T
    })
  }

  private run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params)
    this.scheduleSave()
  }

  // === Products CRUD ===

  getProducts(filters?: {
    search?: string
    categoryId?: string
    activeOnly?: boolean
    lowStock?: boolean
    orderBy?: string
    orderDir?: 'ASC' | 'DESC'
    limit?: number
    offset?: number
  }): Product[] {
    let sql = 'SELECT * FROM products WHERE 1=1'
    const params: unknown[] = []

    if (filters?.search) {
      sql += ' AND (name LIKE ? OR sku LIKE ? OR barcode_value LIKE ?)'
      const term = `%${filters.search}%`
      params.push(term, term, term)
    }
    if (filters?.categoryId) {
      sql += ' AND category_id = ?'
      params.push(filters.categoryId)
    }
    if (filters?.activeOnly) {
      sql += ' AND is_active = 1'
    }
    if (filters?.lowStock) {
      sql += ' AND stock_quantity < min_stock_alert'
    }

    const allowedColumns = new Set(['name', 'sku', 'price', 'cost', 'stock_quantity', 'created_at', 'updated_at'])
    const orderBy = allowedColumns.has(filters?.orderBy || '') ? filters!.orderBy! : 'created_at'
    const orderDir = filters?.orderDir === 'ASC' ? 'ASC' : 'DESC'
    sql += ` ORDER BY ${orderBy} ${orderDir}`

    if (filters?.limit) {
      sql += ' LIMIT ?'
      params.push(filters.limit)
      if (filters?.offset) {
        sql += ' OFFSET ?'
        params.push(filters.offset)
      }
    }

    return this.queryAll<Product>(sql, params)
  }

  getProduct(id: string): Product | null {
    return this.queryOne<Product>('SELECT * FROM products WHERE id = ?', [id])
  }

  getProductByBarcode(barcode: string): Product | null {
    return this.queryOne<Product>('SELECT * FROM products WHERE barcode_value = ?', [barcode])
  }

  getProductBySku(sku: string): Product | null {
    return this.queryOne<Product>('SELECT * FROM products WHERE sku = ?', [sku])
  }

  createProduct(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): string {
    const id = this.generateId()
    const now = this.now()
    this.run(
      `INSERT INTO products (id, sku, name, description, category_id, price, cost, stock_quantity, min_stock_alert, barcode_value, barcode_type, unit, image_blob, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.sku, data.name, data.description, data.category_id, data.price, data.cost, data.stock_quantity, data.min_stock_alert, data.barcode_value, data.barcode_type, data.unit, data.image_blob, data.is_active, now, now]
    )
    return id
  }

  updateProduct(id: string, data: Partial<Omit<Product, 'id' | 'created_at'>>): void {
    const fields: string[] = []
    const params: unknown[] = []

    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'created_at') continue
      fields.push(`${key} = ?`)
      params.push(value)
    }

    fields.push('updated_at = ?')
    params.push(this.now())
    params.push(id)

    this.run(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params)
  }

  deleteProduct(id: string): void {
    this.run('DELETE FROM products WHERE id = ?', [id])
  }

  getProductCount(): number {
    const result = this.db.exec('SELECT COUNT(*) as count FROM products WHERE is_active = 1')
    return result.length > 0 ? (result[0].values[0][0] as number) : 0
  }

  getLowStockCount(): number {
    const result = this.db.exec('SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_quantity < min_stock_alert')
    return result.length > 0 ? (result[0].values[0][0] as number) : 0
  }

  getInventoryValue(): number {
    const result = this.db.exec('SELECT COALESCE(SUM(price * stock_quantity), 0) as total FROM products WHERE is_active = 1')
    return result.length > 0 ? (result[0].values[0][0] as number) : 0
  }

  // === Categories CRUD ===

  getCategories(): Category[] {
    return this.queryAll<Category>('SELECT * FROM categories ORDER BY name ASC')
  }

  getCategory(id: string): Category | null {
    return this.queryOne<Category>('SELECT * FROM categories WHERE id = ?', [id])
  }

  createCategory(name: string, color?: string, icon?: string): string {
    const id = this.generateId()
    this.run('INSERT INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)', [
      id,
      name,
      color || '#C47A3A',
      icon || 'tag',
    ])
    return id
  }

  updateCategory(id: string, data: Partial<Omit<Category, 'id' | 'created_at'>>): void {
    const fields: string[] = []
    const params: unknown[] = []
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`)
      params.push(value)
    }
    params.push(id)
    this.run(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params)
  }

  deleteCategory(id: string): void {
    this.run('DELETE FROM categories WHERE id = ?', [id])
  }

  // === Label Templates CRUD ===

  getTemplates(): LabelTemplate[] {
    return this.queryAll<LabelTemplate>('SELECT * FROM label_templates ORDER BY updated_at DESC')
  }

  getTemplate(id: string): LabelTemplate | null {
    return this.queryOne<LabelTemplate>('SELECT * FROM label_templates WHERE id = ?', [id])
  }

  createTemplate(data: Omit<LabelTemplate, 'id' | 'created_at' | 'updated_at'>): string {
    const id = this.generateId()
    const now = this.now()
    this.run(
      `INSERT INTO label_templates (id, name, description, width_mm, height_mm, canvas_json, is_default, paper_size, columns, rows, margin_top_mm, margin_left_mm, gap_x_mm, gap_y_mm, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.description, data.width_mm, data.height_mm, data.canvas_json, data.is_default, data.paper_size, data.columns, data.rows, data.margin_top_mm, data.margin_left_mm, data.gap_x_mm, data.gap_y_mm, now, now]
    )
    return id
  }

  updateTemplate(id: string, data: Partial<Omit<LabelTemplate, 'id' | 'created_at'>>): void {
    const fields: string[] = []
    const params: unknown[] = []
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'created_at') continue
      fields.push(`${key} = ?`)
      params.push(value)
    }
    fields.push('updated_at = ?')
    params.push(this.now())
    params.push(id)
    this.run(`UPDATE label_templates SET ${fields.join(', ')} WHERE id = ?`, params)
  }

  deleteTemplate(id: string): void {
    this.run('DELETE FROM label_templates WHERE id = ?', [id])
  }

  // === Print History ===

  getPrintHistory(limit = 50, offset = 0): PrintHistory[] {
    return this.queryAll<PrintHistory>(
      'SELECT * FROM print_history ORDER BY printed_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    )
  }

  addPrintRecord(templateId: string | null, productIds: string[], quantity: number, status = 'completed'): string {
    const id = this.generateId()
    this.run(
      'INSERT INTO print_history (id, template_id, product_ids, quantity, status) VALUES (?, ?, ?, ?, ?)',
      [id, templateId, JSON.stringify(productIds), quantity, status]
    )
    return id
  }

  getPrintCountToday(): number {
    const result = this.db.exec("SELECT COALESCE(SUM(quantity), 0) FROM print_history WHERE date(printed_at) = date('now') AND status = 'completed'")
    return result.length > 0 ? (result[0].values[0][0] as number) : 0
  }

  getPrintCountWeek(): number {
    const result = this.db.exec("SELECT COALESCE(SUM(quantity), 0) FROM print_history WHERE printed_at >= datetime('now', '-7 days') AND status = 'completed'")
    return result.length > 0 ? (result[0].values[0][0] as number) : 0
  }

  getPrintCountMonth(): number {
    const result = this.db.exec("SELECT COALESCE(SUM(quantity), 0) FROM print_history WHERE printed_at >= datetime('now', '-30 days') AND status = 'completed'")
    return result.length > 0 ? (result[0].values[0][0] as number) : 0
  }

  // === Inventory Movements ===

  getMovements(filters?: {
    productId?: string
    type?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }): InventoryMovement[] {
    let sql = 'SELECT * FROM inventory_movements WHERE 1=1'
    const params: unknown[] = []

    if (filters?.productId) {
      sql += ' AND product_id = ?'
      params.push(filters.productId)
    }
    if (filters?.type) {
      sql += ' AND type = ?'
      params.push(filters.type)
    }
    if (filters?.startDate) {
      sql += ' AND created_at >= ?'
      params.push(filters.startDate)
    }
    if (filters?.endDate) {
      sql += ' AND created_at <= ?'
      params.push(filters.endDate)
    }

    sql += ' ORDER BY created_at DESC'

    if (filters?.limit) {
      sql += ' LIMIT ?'
      params.push(filters.limit)
      if (filters?.offset) {
        sql += ' OFFSET ?'
        params.push(filters.offset)
      }
    }

    return this.queryAll<InventoryMovement>(sql, params)
  }

  addMovement(data: Omit<InventoryMovement, 'id' | 'created_at'>): string {
    const id = this.generateId()

    this.run(
      'INSERT INTO inventory_movements (id, product_id, type, quantity, reason, reference) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.product_id, data.type, data.quantity, data.reason, data.reference]
    )

    // Update stock
    const multiplier = data.type === 'entrada' || data.type === 'devolucion' ? 1 : -1
    this.run(
      'UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?',
      [data.quantity * multiplier, this.now(), data.product_id]
    )

    return id
  }

  getMovementsLast7Days(): Array<{ date: string; entradas: number; salidas: number }> {
    const result = this.db.exec(`
      SELECT
        date(created_at) as date,
        SUM(CASE WHEN type IN ('entrada', 'devolucion') THEN quantity ELSE 0 END) as entradas,
        SUM(CASE WHEN type IN ('salida', 'ajuste') THEN quantity ELSE 0 END) as salidas
      FROM inventory_movements
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `)

    if (result.length === 0) return []
    return result[0].values.map((row) => ({
      date: row[0] as string,
      entradas: (row[1] as number) || 0,
      salidas: (row[2] as number) || 0,
    }))
  }

  // === Settings ===

  getSetting(key: string): string | null {
    const row = this.queryOne<AppSetting>('SELECT * FROM app_settings WHERE key = ?', [key])
    return row?.value ?? null
  }

  setSetting(key: string, value: string): void {
    this.run(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      [key, value, this.now()]
    )
  }

  // === Utility ===

  vacuum(): void {
    this.db.run('VACUUM')
    this.persistToIndexedDB()
  }

  getDatabaseSize(): number {
    const data = this.db.export()
    return data.length
  }

  exportDatabase(): Uint8Array {
    return this.db.export()
  }

  async importDatabase(data: ArrayBuffer): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `/${file}`,
    })
    this.database = new SQL.Database(new Uint8Array(data))
    await this.persistToIndexedDB()
  }

  getRecentActivity(limit = 5): Array<{ type: string; description: string; date: string }> {
    const movements = this.queryAll<InventoryMovement & { product_name: string }>(
      `SELECT im.*, p.name as product_name FROM inventory_movements im
       JOIN products p ON p.id = im.product_id
       ORDER BY im.created_at DESC LIMIT ?`,
      [limit]
    )

    return movements.map((m) => ({
      type: m.type,
      description: `${m.type === 'entrada' ? 'Entrada' : m.type === 'salida' ? 'Salida' : m.type === 'ajuste' ? 'Ajuste' : 'Devolucion'}: ${m.quantity} x ${m.product_name}`,
      date: m.created_at,
    }))
  }
}

export const db = new DatabaseManager()
