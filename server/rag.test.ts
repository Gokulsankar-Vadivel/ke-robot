import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cleanText, chunkPages } from './chunker';
import { computeLocalEmbedding, cosineSimilarity } from './embeddings';
import { retrieveChunks } from './retrieval';
import { extractDocumentContent, validateUploadFile } from './extractor';

test('cleanText normalizes excessive whitespace while keeping paragraph breaks', () => {
  const raw = 'Line   one\u0000\r\n\r\n\r\nLine\t\ttwo   ';
  assert.equal(cleanText(raw), 'Line one\n\nLine two');
});

test('chunkPages preserves page numbers, metadata, and unique IDs', () => {
  const pages = [
    {
      pageNumber: 1,
      text: 'Paragraph one explains forward kinematics with Denavit-Hartenberg parameters.\n\nParagraph two covers homogeneous transformation matrices.',
    },
    {
      pageNumber: 2,
      text: 'Page two introduces inverse kinematics and the manipulator Jacobian matrix.',
    },
  ];

  const chunks = chunkPages(
    pages,
    {
      docId: 'doc_test_1',
      filename: 'kinematics.txt',
      domain: 'Robotic Arms & Kinematics',
      fileType: 'txt',
      docVersion: 2,
    },
    220,
    40,
  );

  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0].pageNumber, 1);
  assert.equal(chunks[chunks.length - 1].pageNumber, 2);
  const ids = new Set(chunks.map((c) => c.id));
  assert.equal(ids.size, chunks.length);
  assert.ok(chunks.every((c) => c.docVersion === 2 && c.domain === 'Robotic Arms & Kinematics'));
});

test('local embeddings produce L2-normalized vectors with higher similarity for related robotics text', () => {
  const qVec = computeLocalEmbedding('PID controller derivative gain overshoot damping');
  const relevantVec = computeLocalEmbedding(
    'Derivative gain Kd adds damping to a PID feedback loop to reduce overshoot.',
  );
  const unrelatedVec = computeLocalEmbedding(
    'Classical chocolate cake baking requires flour, sugar, cocoa powder, and eggs.',
  );

  const norm = Math.sqrt(qVec.reduce((sum, x) => sum + x * x, 0));
  assert.ok(Math.abs(norm - 1) < 0.01);

  const simRel = cosineSimilarity(qVec, relevantVec);
  const simUnrel = cosineSimilarity(qVec, unrelatedVec);
  assert.ok(simRel > simUnrel, `Expected ${simRel} > ${simUnrel}`);
});

test('retrieveChunks ranks matching domain chunks highest and honors metadata filters', () => {
  const docs = [
    {
      id: 'c1',
      docId: 'd1',
      filename: 'pid.txt',
      domain: 'Motor Control',
      fileType: 'txt',
      docVersion: 1,
      chunkIndex: 0,
      pageNumber: 2,
      content: 'Integrator anti-windup prevents overshoot when PWM saturates.',
      wordCount: 8,
      embedding: computeLocalEmbedding('Integrator anti-windup prevents overshoot when PWM saturates.'),
    },
    {
      id: 'c2',
      docId: 'd2',
      filename: 'ros2.txt',
      domain: 'ROS and ROS2',
      fileType: 'pdf',
      docVersion: 1,
      chunkIndex: 0,
      pageNumber: 1,
      content: 'ROS2 uses DDS discovery and QoS profiles for topic communication.',
      wordCount: 11,
      embedding: computeLocalEmbedding('ROS2 uses DDS discovery and QoS profiles for topic communication.'),
    },
  ];

  const q = 'How does anti-windup handle PWM saturation?';
  const results = retrieveChunks(q, docs, computeLocalEmbedding(q), {
    mode: 'hybrid',
    topK: 2,
  });

  assert.equal(results[0].chunkId, 'c1');
  assert.equal(results[0].pageNumber, 2);

  const filtered = retrieveChunks(q, docs, computeLocalEmbedding(q), {
    mode: 'hybrid',
    topK: 2,
    domainFilter: 'ROS and ROS2',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].chunkId, 'c2');
});

test('validateUploadFile rejects unsupported extensions and empty files', () => {
  const badExt = validateUploadFile('malware.exe', 1024);
  assert.equal(badExt.valid, false);

  const empty = validateUploadFile('notes.pdf', 0);
  assert.equal(empty.valid, false);

  const valid = validateUploadFile('lecture.docx', 2048);
  assert.equal(valid.valid, true);
});

test('extractDocumentContent rejects empty/corrupted buffers and extracts sample TXT with pages', async () => {
  const emptyRes = await extractDocumentContent('empty.txt', Buffer.from('   \n  '));
  assert.equal(emptyRes.ok, false);

  const corruptPdf = await extractDocumentContent('broken.pdf', Buffer.from('not-a-valid-pdf'));
  assert.equal(corruptPdf.ok, false);

  const samplePath = path.resolve(
    process.cwd(),
    'Robotics-Knowledge-Assistant',
    'data',
    'sample_documents',
    '01_Robotics_Fundamentals_and_Kinematics.txt',
  );
  const sampleBuf = fs.readFileSync(samplePath);
  const sampleRes = await extractDocumentContent('01_Robotics_Fundamentals_and_Kinematics.txt', sampleBuf);
  assert.equal(sampleRes.ok, true);
  assert.equal(sampleRes.pageCount, 3);
  assert.equal(sampleRes.pages[1].pageNumber, 2);
});
