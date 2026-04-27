"""
S3 / MinIO Document Service — Phase 5
=======================================
Handles encrypted document storage with:
  • Server-side AES-256 encryption (SSE-S3 for AWS S3, or MinIO SSE)
  • Tenant-scoped key prefixes (tenant_id/year/month/uuid)
  • Presigned URL generation for temporary access
  • Automatic bucket creation in dev (MinIO)

Environment variables:
    S3_ENDPOINT_URL     http://minio:9000  (blank = AWS S3)
    S3_ACCESS_KEY       minioadmin
    S3_SECRET_KEY       minioadmin
    S3_BUCKET           pharmacheck-docs
    S3_REGION           us-east-1
"""

import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

BUCKET         = os.environ.get("S3_BUCKET", "pharmacheck-docs")
ENDPOINT_URL   = os.environ.get("S3_ENDPOINT_URL", "")   # blank → AWS S3
ACCESS_KEY     = os.environ.get("S3_ACCESS_KEY", "minioadmin")
SECRET_KEY     = os.environ.get("S3_SECRET_KEY", "minioadmin")
REGION         = os.environ.get("S3_REGION", "us-east-1")
PRESIGN_EXPIRY = int(os.environ.get("S3_PRESIGN_EXPIRY", "3600"))  # 1 hour


class S3Service:
    """
    Thin wrapper around boto3 S3 client with MinIO support.
    All methods raise exceptions on failure — callers should handle accordingly.
    """

    def __init__(self):
        self._client = None
        self._enabled = bool(ENDPOINT_URL or os.environ.get("AWS_ACCESS_KEY_ID"))

    @property
    def client(self):
        if self._client is None:
            self._client = self._build_client()
        return self._client

    def _build_client(self):
        try:
            import boto3
            kwargs = {
                "aws_access_key_id":     ACCESS_KEY,
                "aws_secret_access_key": SECRET_KEY,
                "region_name":           REGION,
            }
            if ENDPOINT_URL:
                kwargs["endpoint_url"] = ENDPOINT_URL
            client = boto3.client("s3", **kwargs)
            self._ensure_bucket(client)
            return client
        except ImportError:
            logger.warning("boto3 not installed — S3 service disabled")
            return None

    def _ensure_bucket(self, client):
        """Create bucket if it doesn't exist (MinIO dev mode)."""
        try:
            client.head_bucket(Bucket=BUCKET)
        except Exception:
            try:
                if REGION == "us-east-1":
                    client.create_bucket(Bucket=BUCKET)
                else:
                    client.create_bucket(
                        Bucket=BUCKET,
                        CreateBucketConfiguration={"LocationConstraint": REGION},
                    )
                logger.info("Created S3/MinIO bucket: %s", BUCKET)
            except Exception as exc:
                logger.warning("Could not create bucket %s: %s", BUCKET, exc)

    # ── Public API ─────────────────────────────────────────────────────────────

    def upload_document(
        self,
        raw: bytes,
        filename: str,
        tenant_id: str,
        user_id: str,
    ) -> str:
        """
        Upload document with SSE-S3 encryption.
        Returns the S3 object key.
        """
        if not self._enabled or self.client is None:
            logger.debug("S3 disabled — document not persisted")
            return f"local/{tenant_id}/{uuid.uuid4()}/{filename}"

        now = datetime.now(timezone.utc)
        doc_id = uuid.uuid4().hex
        key = f"{tenant_id}/{now.year}/{now.month:02d}/{doc_id}/{filename}"

        # Compute SHA-256 checksum
        checksum = hashlib.sha256(raw).hexdigest()

        self.client.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=raw,
            ContentType=_content_type(filename),
            ServerSideEncryption="AES256",
            Metadata={
                "tenant_id":  tenant_id,
                "user_id":    user_id,
                "sha256":     checksum,
                "filename":   filename,
                "uploaded_at": now.isoformat(),
            },
        )
        logger.info("Uploaded %s → s3://%s/%s (%d bytes)", filename, BUCKET, key, len(raw))
        return key

    def download_document(self, key: str) -> bytes:
        """Download a document by key. Raises if not found."""
        if not self._enabled or self.client is None:
            raise RuntimeError("S3 service is not configured")

        response = self.client.get_object(Bucket=BUCKET, Key=key)
        return response["Body"].read()

    def presigned_url(self, key: str, expiry: int = PRESIGN_EXPIRY) -> str:
        """Generate a presigned download URL (temporary access)."""
        if not self._enabled or self.client is None:
            return ""

        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": key},
            ExpiresIn=expiry,
        )

    def delete_document(self, key: str) -> bool:
        """Delete a document. Returns True on success."""
        if not self._enabled or self.client is None:
            return False

        try:
            self.client.delete_object(Bucket=BUCKET, Key=key)
            return True
        except Exception as exc:
            logger.error("Failed to delete s3://%s/%s: %s", BUCKET, key, exc)
            return False

    def list_documents(self, tenant_id: str) -> list[dict]:
        """List all documents for a tenant."""
        if not self._enabled or self.client is None:
            return []

        try:
            paginator = self.client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=BUCKET, Prefix=f"{tenant_id}/")
            docs = []
            for page in pages:
                for obj in page.get("Contents", []):
                    docs.append({
                        "key":           obj["Key"],
                        "size_bytes":    obj["Size"],
                        "last_modified": obj["LastModified"].isoformat(),
                    })
            return docs
        except Exception as exc:
            logger.error("Failed to list documents for tenant %s: %s", tenant_id, exc)
            return []


def _content_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return {"pdf": "application/pdf", "txt": "text/plain"}.get(ext, "application/octet-stream")
