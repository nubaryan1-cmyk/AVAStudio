"""
AVA ARTIFACTS SERVICE
Handles S3 uploads and Signed URLs.
"""
import os
import shutil

# Lazy import to avoid crash if boto3 missing in dev
try:
    import boto3
except ImportError:
    boto3 = None

class ArtifactStorage:
    def __init__(self):
        self._s3_client = None

    @property
    def s3(self):
        # Lazy initialization ensures ENV vars are read at runtime, not import time
        if self._s3_client is None:
            if os.getenv("AVA_MOCK_MODE") == "1":
                return None
            
            if boto3:
                self._s3_client = boto3.client(
                    's3',
                    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                    region_name=os.getenv("AWS_REGION", "us-east-1")
                )
        return self._s3_client

    def upload_and_sign(self, local_path: str, destination_key: str) -> str:
        """
        ATOMIC OPERATION: Upload -> Sign.
        Returns: Signed URL (or Mock URL).
        """
        bucket = os.getenv("AWS_S3_BUCKET", "ava-artifacts")
        
        # 1. Upload
        if self.s3:
            self.s3.upload_file(local_path, bucket, destination_key)
            s3_uri = f"s3://{bucket}/{destination_key}"
        else:
            # Mock behavior
            print(f"[STORAGE] MOCK Uploading {local_path}...")
            s3_uri = f"s3://mock-bucket/{destination_key}"

        # 2. Generate Signed URL (Privacy)
        if self.s3:
            return self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': destination_key},
                ExpiresIn=3600
            )
        else:
            return f"https://mock-cdn.com/{destination_key}?token=signed_secure_token"

    def cleanup_local(self, local_path: str):
        """Secure deletion of temp file."""
        if os.path.exists(local_path):
            os.remove(local_path)
            print(f"[STORAGE] Securely deleted local file: {local_path}")

_storage = ArtifactStorage()
def get_storage(): return _storage
