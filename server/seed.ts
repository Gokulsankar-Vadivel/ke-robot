import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { APP_CONFIG } from './config';
import { chunkPages } from './chunker';
import { computeLocalEmbedding } from './embeddings';
import { extractDocumentContent } from './extractor';
import { listDocuments, saveDocumentWithChunks } from './database';

const SAMPLE_DOC_METADATA: Record<string, string> = {
  '01_Robotics_Fundamentals_and_Kinematics.txt': 'Robotic Arms & Kinematics',
  '02_Sensors_Actuators_and_Microcontrollers.txt': 'Sensors and Actuators',
  '03_Motor_Control_and_PID_Systems.txt': 'Motor Control',
  '04_ROS2_Architecture_and_Navigation.txt': 'ROS and ROS2',
  '05_SLAM_Path_Planning_and_Computer_Vision.txt': 'SLAM & Path Planning',
  '06_Industrial_Robotics_Safety_and_Troubleshooting.txt': 'Safety & Troubleshooting',
};

/**
 * Seeds institutional sample robotics documents ONLY when the database has zero documents.
 * Never overwrites or resets existing user documents on subsequent restarts.
 */
export async function seedSampleDocumentsIfEmpty(): Promise<number> {
  const existing = listDocuments();
  if (existing.length > 0) {
    return 0;
  }

  if (!fs.existsSync(APP_CONFIG.sampleDocsDir)) {
    return 0;
  }

  const files = fs
    .readdirSync(APP_CONFIG.sampleDocsDir)
    .filter((f) => f.endsWith('.txt'))
    .sort();

  let seededCount = 0;

  for (const filename of files) {
    const filePath = path.join(APP_CONFIG.sampleDocsDir, filename);
    const buffer = fs.readFileSync(filePath);
    const extracted = await extractDocumentContent(filename, buffer);
    if (!extracted.ok) continue;

    const docId = `doc_${crypto.createHash('md5').update(filename).digest('hex').slice(0, 12)}`;
    const domain = SAMPLE_DOC_METADATA[filename] || 'Robotics Fundamentals';
    const chunks = chunkPages(
      extracted.pages,
      {
        docId,
        filename,
        domain,
        fileType: extracted.fileType,
        docVersion: 1,
      },
      APP_CONFIG.defaultChunkSize,
      APP_CONFIG.defaultChunkOverlap,
    );

    const chunksWithEmbeddings = chunks.map((chunk) => ({
      chunk,
      embedding: computeLocalEmbedding(chunk.content),
    }));

    saveDocumentWithChunks(
      {
        id: docId,
        filename,
        fileType: extracted.fileType,
        fileSize: buffer.length,
        fileHash: extracted.fileHash,
        domain,
        version: 1,
        pageCount: extracted.pageCount,
        chunkCount: chunks.length,
        status: 'indexed',
        errorMessage: null,
        needsOcr: false,
        storagePath: filePath,
      },
      chunksWithEmbeddings,
    );

    seededCount += 1;
  }

  return seededCount;
}
