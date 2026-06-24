"""vision_ai API package (lightweight API glue for RIM uploads and ingest).
This module contains DRF serializers and views that wrap existing
vision task logic (see server/vision/tasks.py). The heavy image/LLM
work remains in `vision.tasks` and `vision.llm` — these views only
establish a stable HTTP contract for the frontend.
"""
