import sqlite3
from ledger import verify_ledger
from database import get_db

db = get_db()
res = verify_ledger(db)
print("Verify Result:", res)
db.close()
