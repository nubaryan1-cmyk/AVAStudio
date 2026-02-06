"""
AVA WORKER PIPELINE
Orchestrates the transition from Raw Files -> Cloud Artifacts.
"""
import os
from services.artifacts import get_storage
from services.secure_logging import get_secure_logger

logger = get_secure_logger("worker_pipeline")

def finalize_job_artifacts(job_id: str, local_files: list[str]) -> list[dict]:
    """
    Takes local file paths.
    Returns canonical artifact objects with Signed URLs.
    Performs cleanup.
    """
    storage = get_storage()
    results = []

    logger.info(f"Finalizing {len(local_files)} artifacts for job {job_id}")

    for local_path in local_files:
        filename = os.path.basename(local_path)
        # Canonical S3 Key: jobs/{job_id}/{filename}
        s3_key = f"jobs/{job_id}/{filename}"
        
        try:
            # 1. Upload & Sign
            signed_url = storage.upload_and_sign(local_path, s3_key)
            
            # 2. Record Metadata
            results.append({
                "type": "image", # simplified inference
                "uri": signed_url, # THE IMPORTANT PART: Signed URL, not local path
                "name": filename
            })
            
            # 3. Cleanup (Critical for Disk Space & Security)
            storage.cleanup_local(local_path)
            
        except Exception as e:
            logger.error(f"Failed to process artifact {filename}: {e}")
            # Don't fail the whole job if one file fails, but log it
    
    return results
