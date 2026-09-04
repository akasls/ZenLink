import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, promises as fsPromises } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 数据库文件存储在 server/data/ 目录下，方便单文件备份
const DATA_DIR = join(__dirname, '../../data');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = join(DATA_DIR, 'zenlink.db');

let db: SqlJsDatabase;

/**
 * 初始化数据库（异步，需要加载 WASM）
 */
export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  // 如果数据库文件已存在，加载它
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 执行建表 SQL
  const schemaPath = existsSync(join(__dirname, 'schema.sql'))
    ? join(__dirname, 'schema.sql')
    : join(__dirname, '../../src/db/schema.sql');
  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf-8');
    db.run(schema);
  }

  // 保存到文件
  saveDatabase(true);
  // 扩展表字段与配置
  try { db.run("CREATE TABLE IF NOT EXISTS storage_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);"); } catch {}
  try { db.run("ALTER TABLE ai_conversations ADD COLUMN role_id TEXT DEFAULT 'default';"); } catch {}
  try { db.run("ALTER TABLE ai_conversations ADD COLUMN icon TEXT DEFAULT '';"); } catch {}
  try { db.run("ALTER TABLE notes ADD COLUMN tags TEXT DEFAULT '[]';"); } catch {}
  // 性能索引加速
  try { db.run("CREATE INDEX IF NOT EXISTS idx_bookmarks_sort ON bookmarks(sort_order);"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated ON ai_conversations(updated_at DESC);"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_note_shares_nid ON note_shares(note_id);"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_notes_pinned_updated ON notes(is_pinned DESC, updated_at DESC);"); } catch {}

  console.log('✅ 数据库初始化完成与高性能索引生效:', DB_PATH);
}

let saveTimer: NodeJS.Timeout | null = null;
let isSaving = false;
let hasPendingSave = false;

async function executeSave(): Promise<void> {
  if (isSaving) {
    hasPendingSave = true;
    return;
  }
  isSaving = true;
  hasPendingSave = false;

  try {
    const data = db.export();
    const tempPath = `${DB_PATH}.tmp`;
    await fsPromises.writeFile(tempPath, Buffer.from(data));
    await fsPromises.rename(tempPath, DB_PATH);
  } catch (e) {
    console.error('❌ 异步持久化数据库失败:', e);
  } finally {
    isSaving = false;
    if (hasPendingSave) {
      hasPendingSave = false;
      executeSave();
    }
  }
}

/**
 * 将内存中的数据库安全、原子化、防抖持久化到文件
 * @param immediate 若为 true 则立即同步原子持久化（用于服务关闭退出等关键时刻）
 */
export function saveDatabase(immediate = false): void {
  if (immediate) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    hasPendingSave = false;
    try {
      const data = db.export();
      const tempPath = `${DB_PATH}.tmp`;
      writeFileSync(tempPath, Buffer.from(data));
      renameSync(tempPath, DB_PATH);
    } catch (e) {
      console.error('❌ 同步写入数据库失败:', e);
    }
    return;
  }

  if (saveTimer) {
    return;
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;
    executeSave();
  }, 500);
}

/**
 * 获取数据库实例
 */
export function getDb(): SqlJsDatabase {
  return db;
}

/**
 * 封装常用操作，模拟 better-sqlite3 的同步 API 风格
 */
export const dbHelper = {
  /** 执行查询，返回所有行 */
  all(sql: string, params: any[] = []): any[] {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  /** 执行查询，返回第一行 */
  get(sql: string, params: any[] = []): any | undefined {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let result: any = undefined;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  },

  /** 执行写操作（INSERT/UPDATE/DELETE），返回 changes 和 lastInsertRowid */
  run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
    db.run(sql, params);
    const changes = db.getRowsModified();
    const lastRow = dbHelper.get('SELECT last_insert_rowid() as id');
    return { changes, lastInsertRowid: lastRow?.id || 0 };
  },

  /** 执行原始 SQL（无参数） */
  exec(sql: string): void {
    db.run(sql);
  },
};

export default dbHelper;
