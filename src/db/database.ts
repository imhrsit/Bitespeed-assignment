import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "path";

const db: DatabaseType = new Database(path.resolve(__dirname, "../../contacts.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS Contact (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phoneNumber TEXT,
    email TEXT,
    linkedId INTEGER,
    linkPrecedence TEXT NOT NULL CHECK (linkPrecedence IN ('primary', 'secondary')),
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT,
    FOREIGN KEY (linkedId) REFERENCES Contact(id)
  )
`);

export default db;
