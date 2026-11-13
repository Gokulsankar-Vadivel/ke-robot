import { APP_CONFIG } from './config';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'what', 'which', 'who', 'how', 'when', 'where', 'why', 'can',
  'could', 'should', 'would', 'this', 'these', 'those', 'into', 'using', 'used',
]);

const ROBOTICS_CANONICAL_MAP: Record<string, string> = {
  kinematic: 'kinematics',
  kinematics: 'kinematics',
  dynamic: 'dynamics',
  dynamics: 'dynamics',
  actuators: 'actuator',
  actuator: 'actuator',
  sensors: 'sensor',
  sensor: 'sensor',
  microcontrollers: 'microcontroller',
  microcontroller: 'microcontroller',
  motors: 'motor',
  motor: 'motor',
  servos: 'servo',
  servo: 'servo',
  encoders: 'encoder',
  encoder: 'encoder',
  robots: 'robot',
  robot: 'robot',
  robotics: 'robot',
  robotic: 'robot',
  manipulators: 'manipulator',
  manipulator: 'manipulator',
  joints: 'joint',
  joint: 'joint',
  transforms: 'transform',
  transformations: 'transform',
  transformation: 'transform',
  controllers: 'controller',
  controller: 'controller',
  control: 'controller',
  tuning: 'tune',
  tunings: 'tune',
  planners: 'planner',
  planning: 'planner',
  navigation: 'navigate',
  autonomous: 'autonomy',
  collisions: 'collision',
  obstacles: 'obstacle',
  cameras: 'camera',
  lidars: 'lidar',
  imus: 'imu',
  ros2: 'ros2',
  ros: 'ros',
  slam: 'slam',
  pid: 'pid',
  pwm: 'pwm',
  esp32: 'esp32',
  arduino: 'arduino',
  jacobian: 'jacobian',
  denavit: 'dh',
  hartenberg: 'dh',
  ekf: 'kalman',
  kalman: 'kalman',
  odometry: 'odometry',
  torque: 'torque',
  velocity: 'velocity',
  acceleration: 'acceleration',
  safety: 'safety',
  emergency: 'estop',
  estop: 'estop',
};

/**
 * Tokenizes and normalizes text for both dense embeddings and BM25 search.
 */
export function tokenizeText(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9_+-]+/g, ' ')
    .trim();
  if (!cleaned) return [];

  const tokens: string[] = [];
  for (const raw of cleaned.split(/\s+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    let tok = ROBOTICS_CANONICAL_MAP[raw] ?? raw;
    if (tok === raw && tok.length > 4) {
      if (tok.endsWith('ing')) tok = tok.slice(0, -3);
      else if (tok.endsWith('ies')) tok = `${tok.slice(0, -3)}y`;
      else if (tok.endsWith('es') && !tok.endsWith('ses')) tok = tok.slice(0, -2);
      else if (tok.endsWith('s') && !tok.endsWith('ss')) tok = tok.slice(0, -1);
    }
    tok = ROBOTICS_CANONICAL_MAP[tok] ?? tok;
    tokens.push(tok);
  }
  return tokens;
}

function fnv1aHash(str: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/**
 * Generates a deterministic L2-normalized dense embedding vector (384 dims)
 * combining unigram, bigram, and character trigram semantic projections.
 */
export function computeLocalEmbedding(
  text: string,
  dim = APP_CONFIG.embeddingDim,
): number[] {
  const vec = new Float64Array(dim);
  const tokens = tokenizeText(text);
  if (tokens.length === 0) {
    return Array.from(vec);
  }

  // Unigram weights (sublinear TF)
  const termCounts = new Map<string, number>();
  for (const tok of tokens) {
    termCounts.set(tok, (termCounts.get(tok) ?? 0) + 1);
  }

  for (const [tok, count] of termCounts.entries()) {
    const weight = 1 + Math.log(count);
    const h1 = fnv1aHash(tok, 2166136261);
    const h2 = fnv1aHash(tok, 374761393);
    const idx1 = h1 % dim;
    const idx2 = h2 % dim;
    const sign1 = (h1 & 1) === 0 ? 1 : -1;
    const sign2 = (h2 & 1) === 0 ? 1 : -1;
    vec[idx1] += sign1 * weight;
    vec[idx2] += sign2 * (weight * 0.75);

    // Character trigrams for morphological similarity
    if (tok.length >= 4) {
      for (let i = 0; i <= tok.length - 3; i += 1) {
        const tri = tok.slice(i, i + 3);
        const ht = fnv1aHash(tri, 668265263);
        vec[ht % dim] += ((ht & 1) === 0 ? 1 : -1) * 0.28;
      }
    }
  }

  // Bigram phrase projections
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const bigram = `${tokens[i]}_${tokens[i + 1]}`;
    const hb = fnv1aHash(bigram, 1442695041);
    vec[hb % dim] += ((hb & 1) === 0 ? 1 : -1) * 0.9;
  }

  // L2 normalization
  let normSq = 0;
  for (let i = 0; i < dim; i += 1) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq) || 1;
  const normalized = new Array<number>(dim);
  for (let i = 0; i < dim; i += 1) {
    normalized[i] = Number((vec[i] / norm).toFixed(6));
  }
  return normalized;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 0;
  return Math.max(0, Math.min(1, dot / denom));
}
