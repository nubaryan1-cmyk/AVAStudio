"""
VIDEO API V1 (MOCK)
Demonstrates Feature Flag Enforcement (403 Forbidden).
"""
from services.feature_flags import get_flags, FlagContext

class VideoApi:
    def generate_video(self, user_id: str, plan: str, prompt: str):
        # 1. Context
        ctx = FlagContext(user_id=user_id, plan=plan)
        
        # 2. Check Flag
        if not get_flags().is_enabled("video_v2_generation", ctx):
            return {"status": 403, "error": "Feature Disabled"}
            
        # 3. Proceed
        return {"status": 200, "job_id": "vid-123"}

    def get_client_flags(self, user_id: str, plan: str):
        """Endpoint for Frontend to know what to hide."""
        ctx = FlagContext(user_id=user_id, plan=plan)
        return {
            "video_v2": get_flags().is_enabled("video_v2_generation", ctx),
            "photo_beta": get_flags().is_enabled("photo_flux_beta", ctx)
        }
