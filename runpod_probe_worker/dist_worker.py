import services.ssot_env_guard
"""
AVA DISTRIBUTED WORKER

================================================================================
CANON: All state changes MUST go through Job Core
================================================================================

Worker responsibilities:
- Claim jobs from queue (atomic via Job Core)
- Execute job via appropriate executor
- Report completion/failure through Job Core
- Handle retries with backoff

FORBIDDEN:
- Direct state updates (UPDATE jobs SET state = ...)
- Bypassing Job Core for state transitions
"""

import os
import sys
import time
import uuid
import signal
import traceback
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

from services.config import get_config
from services.job_core import get_job_core, JobContract
from services.observability import get_logger, get_metrics, correlation_context, generate_correlation_id
from services.error_taxonomy import create_error, normalize_error


# Import executors
from services.executors.train_lora import TrainLoraExecutor
from services.executors.infer_lora import InferLoraExecutor
from services.executors.generate_image import GenerateImageExecutor
from services.executors.generate_video import GenerateVideoExecutor


logger = get_logger()
metrics = get_metrics()


# =============================================================================
# EXECUTOR MAPPING
# =============================================================================

EXECUTOR_MAP = {
    "photo.generate": GenerateImageExecutor,
    "video.generate": GenerateVideoExecutor,
    "lora.train": TrainLoraExecutor,
    "lora.infer": InferLoraExecutor,
    "train_lora": TrainLoraExecutor,  # Legacy
}


# =============================================================================
# WORKER CONFIG
# =============================================================================

class WorkerConfig:
    """Worker configuration."""
    
    def __init__(self):
        self.worker_id = os.getenv("WORKER_ID", f"worker-{uuid.uuid4().hex[:8]}")
        self.poll_interval = float(os.getenv("WORKER_POLL_INTERVAL", "2"))
        self.max_jobs_per_cycle = int(os.getenv("WORKER_MAX_JOBS", "1"))
        self.job_types = os.getenv("WORKER_JOB_TYPES", "").split(",") or None
        self.job_timeout = int(os.getenv("WORKER_JOB_TIMEOUT", "600"))  # 10 min
        
        # Filter empty strings
        if self.job_types:
            self.job_types = [jt.strip() for jt in self.job_types if jt.strip()]
            if not self.job_types:
                self.job_types = None


# =============================================================================
# DISTRIBUTED WORKER
# =============================================================================

class DistributedWorker:
    """
    Distributed job worker.
    
    Polls queue and executes jobs via executors.
    All state transitions go through Job Core.
    """
    
    def __init__(self, config: Optional[WorkerConfig] = None):
        self.config = config or WorkerConfig()
        self.job_core = get_job_core()
        self.running = False
        self._current_job: Optional[JobContract] = None
        
        logger.info("worker_initialized", 
                   worker_id=self.config.worker_id,
                   job_types=self.config.job_types)
    
    def start(self) -> None:
        """
        Start worker main loop.
        """
        self.running = True
        
        # Setup signal handlers
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        signal.signal(signal.SIGINT, self._handle_shutdown)
        
        logger.info("worker_started", worker_id=self.config.worker_id)
        
        while self.running:
            try:
                self._process_cycle()
            except Exception as e:
                logger.error("worker_cycle_error", error=str(e))
                metrics.record_error("fatal", "WORKER_CYCLE_ERROR")
            
            time.sleep(self.config.poll_interval)
        
        logger.info("worker_stopped", worker_id=self.config.worker_id)
    
    def stop(self) -> None:
        """Stop worker."""
        self.running = False
    
    def _process_cycle(self) -> None:
        """
        Process one worker cycle.
        """
        # Claim job from queue (atomic)
        job = self.job_core.claim_next_job(
            worker_id=self.config.worker_id,
            job_types=self.config.job_types
        )
        
        if not job:
            return  # No jobs available
        
        self._current_job = job
        
        # Setup correlation context
        with correlation_context(job.correlation_id or generate_correlation_id()):
            try:
                self._execute_job(job)
            except Exception as e:
                self._handle_job_error(job, e)
            finally:
                self._current_job = None
    
    def _execute_job(self, job: JobContract) -> None:
        """
        Execute job.
        """
        logger.info("job_execution_started",
                   job_id=job.job_id,
                   job_type=job.job_type,
                   worker_id=self.config.worker_id)
        
        # Transition: SCHEDULED -> RUNNING
        job = self.job_core.start_job(job.job_id, self.config.worker_id)
        
        # Get executor
        executor_class = EXECUTOR_MAP.get(job.job_type)
        if not executor_class:
            raise ValueError(f"Unknown job type: {job.job_type}")
        
        # Prepare executor payload
        executor_payload = {
            "job_id": job.job_id,
            "payload": job.payload,
            "user_id": job.user_id,
            "correlation_id": job.correlation_id
        }
        
        # Execute
        executor = executor_class(executor_payload)
        start_time = time.time()
        
        try:
            result = executor.run()
        except Exception as e:
            # Executor failed
            raise
        
        duration = time.time() - start_time
        
        # Check result
        if result.get("error"):
            # Job failed with error
            self.job_core.fail_job(
                job_id=job.job_id,
                error=result["error"],
                allow_retry=True
            )
            logger.warn("job_execution_failed",
                       job_id=job.job_id,
                       error=result["error"])
        else:
            # Job completed successfully
            self.job_core.complete_job(
                job_id=job.job_id,
                artifacts=result.get("artifacts", []),
                metrics=result.get("metrics", {})
            )
            logger.info("job_execution_completed",
                       job_id=job.job_id,
                       duration=round(duration, 2),
                       artifacts_count=len(result.get("artifacts", [])))
        
        # Record metrics
        metrics.record_job_duration(job.job_type, duration)
    
    def _handle_job_error(self, job: JobContract, error: Exception) -> None:
        """
        Handle job execution error.
        """
        error_str = str(error)
        tb = traceback.format_exc()
        
        logger.error("job_execution_error",
                    job_id=job.job_id,
                    error=error_str,
                    traceback=tb[:1000])
        
        # Check if timeout
        if "timeout" in error_str.lower() or "timed out" in error_str.lower():
            self.job_core.timeout_job(job.job_id, error_str[:500])
        else:
            # Normal failure
            canon_error = normalize_error({
                "class": "fatal",
                "code": "FATAL_INTERNAL",
                "message": error_str[:500]
            })
            self.job_core.fail_job(job.job_id, canon_error, allow_retry=True)
    
    def _handle_shutdown(self, signum, frame) -> None:
        """
        Handle shutdown signal.
        """
        logger.info("worker_shutdown_signal", signal=signum)
        self.running = False
        
        # If currently executing a job, let it complete
        if self._current_job:
            logger.info("worker_draining", job_id=self._current_job.job_id)


# =============================================================================
# MAIN
# =============================================================================

def main():
    """Run worker."""
    config = WorkerConfig()
    worker = DistributedWorker(config)
    worker.start()


if __name__ == "__main__":
    main()
