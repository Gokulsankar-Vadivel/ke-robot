"""Centralized configuration for ROBO KNOWLEDGE AI."""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
SAMPLE_DOCS_DIR = DATA_DIR / "sample_documents"
DATABASE_DIR = BASE_DIR / "database"
CHROMA_DIR = DATABASE_DIR / "chroma_db"
SQLITE_DB_PATH = DATABASE_DIR / "metadata.db"

APP_NAME = "ROBO KNOWLEDGE AI"
PROJECT_TITLE = "AI-Powered Robotics Knowledge Assistant"

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx"}
MAX_FILE_SIZE_MB = 20
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

DEFAULT_CHUNK_SIZE = 750
DEFAULT_CHUNK_OVERLAP = 130

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
CHROMA_COLLECTION_NAME = "robotics_knowledge_base"

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_DEFAULT_MODEL = "llama3.2"

TOP_K_RESULTS = 5
MIN_RELEVANCE_SCORE = 0.28

ROBOTICS_DOMAINS = [
    "Robotics Fundamentals",
    "Robot Components",
    "Sensors and Actuators",
    "Arduino & ESP32",
    "Motor Control",
    "Robotic Arms & Kinematics",
    "Mobile Robots & Dynamics",
    "Industrial Robotics",
    "ROS and ROS2",
    "AI & Computer Vision",
    "SLAM & Path Planning",
    "Safety & Troubleshooting",
]

for directory in (UPLOAD_DIR, SAMPLE_DOCS_DIR, CHROMA_DIR):
    directory.mkdir(parents=True, exist_ok=True)
