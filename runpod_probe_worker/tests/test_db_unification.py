"""
TEST: DB UNIFICATION & PROD SAFETY
"""
import sys
import os
import unittest
from unittest.mock import MagicMock, patch

# Path hack
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import config to reload it
from services import config, db

class TestDBUnification(unittest.TestCase):
    
    def setUp(self):
        # Reset singleton
        config._config = None
        db._db = None

    def test_prod_fails_without_url(self):
        """PROD must crash if DATABASE_URL is missing."""
        os.environ["AVA_ENV"] = "PROD"
        if "DATABASE_URL" in os.environ:
            del os.environ["DATABASE_URL"]
            
        print("\n>>> [TEST] Checking PROD safety guard...")
        with self.assertRaises(RuntimeError) as cm:
            config.get_config()
        
        print(f"    Caught expected error: {cm.exception}")
        self.assertIn("requires DATABASE_URL", str(cm.exception))

    def test_staging_uses_sqlite(self):
        """STAGING should default to SQLite."""
        os.environ["AVA_ENV"] = "STAGING"
        conf = config.get_config()
        self.assertEqual(conf.env, config.Environment.STAGING)
        
        dbi = db.get_db()
        conn = dbi.get_connection()
        print(f"\n>>> [TEST] Staging Connection Type: {type(conn)}")
        
        import sqlite3
        self.assertIsInstance(conn, sqlite3.Connection)
        conn.close()

    @patch("psycopg2.connect")
    def test_prod_uses_postgres_wrapper(self, mock_pg):
        """PROD should use PostgresConnectionWrapper and translate queries."""
        os.environ["AVA_ENV"] = "PROD"
        os.environ["DATABASE_URL"] = "postgresql://user:pass@localhost/db"
        
        # Mock psycopg2 presence
        db.HAS_PG = True
        
        dbi = db.get_db()
        conn = dbi.get_connection()
        
        print(f"\n>>> [TEST] Prod Connection Type: {type(conn)}")
        self.assertEqual(type(conn).__name__, "PostgresConnectionWrapper")
        
        # Test Query Translation (? -> %s)
        mock_cursor = MagicMock()
        conn.conn.cursor.return_value = mock_cursor
        
        sql_sqlite = "SELECT * FROM jobs WHERE id = ?"
        conn.execute(sql_sqlite, ("123",))
        
        # Check if ? was replaced by %s
        args, _ = mock_cursor.execute.call_args
        executed_sql = args[0]
        print(f"    Original SQL: {sql_sqlite}")
        print(f"    Executed SQL: {executed_sql}")
        
        self.assertIn("%s", executed_sql)
        self.assertNotIn("?", executed_sql)

if __name__ == "__main__":
    unittest.main()
