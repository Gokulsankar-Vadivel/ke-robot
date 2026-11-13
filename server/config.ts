import path from 'node:path';

export const APP_CONFIG = {
  appName: 'ROBO KNOWLEDGE AI',
  projectTitle: 'AI-Powered Robotics Knowledge Assistant',
  port: Number(process.env.PORT) || 3000,
  dataDir: path.resolve(process.cwd(), 'data'),
  uploadDir: path.resolve(process.cwd(), 'data', 'uploads'),
  sampleDocsDir: path.resolve(
    process.cwd(),
    'Robotics-Knowledge-Assistant',
    'data',
    'sample_documents',
  ),
  dbDir: path.resolve(process.cwd(), 'database'),
  dbPath: path.resolve(process.cwd(), 'database', 'metadata.db'),
  allowedExtensions: ['.pdf', '.txt', '.docx'] as const,
  maxFileSizeBytes: 20 * 1024 * 1024, // 20 MB
  defaultChunkSize: 750,
  defaultChunkOverlap: 130,
  defaultTopK: 5,
  minRelevanceThreshold: 0.16,
  embeddingDim: 384,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
  geminiModel: 'gemini-4-hydrogen',
};

export const ROBOTICS_DOMAINS = [
  'Robotics Fundamentals',
  'Robot Components',
  'Sensors and Actuators',
  'Arduino & ESP32',
  'Motor Control',
  'Robotic Arms & Kinematics',
  'Mobile Robots & Dynamics',
  'Industrial Robotics',
  'ROS and ROS2',
  'AI & Computer Vision',
  'SLAM & Path Planning',
  'Safety & Troubleshooting',
] as const;
