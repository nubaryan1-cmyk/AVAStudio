"""
STAGE 10: REAL-TIME FLAGS & API BLOCKING
"""
import unittest
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.db import get_db
from services.feature_flags import get_flags
from services.api_mock_video import VideoApi

class TestStage10(unittest.TestCase):
    def setUp(self):
        os.environ["AVA_MOCK_MODE"] = "1"
        self.db = get_db()
        self.db.init_schema()
        self.api = VideoApi()
        
        # Reset DB flags
        with self.db.get_connection() as conn:
            conn.execute("DELETE FROM runtime_flags")
            conn.commit()
            
    def test_kill_switch_blocks_api(self):
        print("\n>>> TESTING KILL SWITCH ENFORCEMENT...")
        
        user_id = "vip_user"
        plan = "PRO" # Should have access by default (Canon)
        
        # 1. Normal State -> 200 OK
        resp = self.api.generate_video(user_id, plan, "cat video")
        print(f"   [1] Normal Call: {resp['status']}")
        self.assertEqual(resp["status"], 200)
        
        # 2. Frontend Check
        flags = self.api.get_client_flags(user_id, plan)
        self.assertTrue(flags["video_v2"], "UI should show video button")
        
        # 3. ACTIVATE KILL SWITCH (DB)
        print("   [2] Activating DB Kill Switch...")
        with self.db.get_connection() as conn:
            conn.execute(
                "INSERT INTO runtime_flags (flag_key, kill_switch) VALUES (?, ?)", 
                ("video_v2_generation", 1)
            )
            conn.commit()
            
        # 4. Blocked State -> 403 Forbidden
        resp = self.api.generate_video(user_id, plan, "cat video")
        print(f"   [3] Blocked Call: {resp['status']} ({resp.get('error')})")
        self.assertEqual(resp["status"], 403)
        
        # 5. Frontend Check (Should Hide)
        flags = self.api.get_client_flags(user_id, plan)
        self.assertFalse(flags["video_v2"], "UI should HIDE video button")
        print("   [4] Frontend Flag: False (UI Hidden)")

if __name__ == "__main__":
    unittest.main()
