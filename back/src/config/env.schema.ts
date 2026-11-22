import { z } from 'zod';
import { isLoopbackBindHost } from '../auth/local-access';

const optionalSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

/**
 * Model ids are passed to the configured OpenAI-compatible endpoint as-is:
 * `gpt-4.1-mini` for OpenAI, `openai/gpt-4.1-mini` for OpenRouter,
 * `llama3.1:8b` for Ollama.
 */
const optionalModelId = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const VIDEO_STORAGE_KEYS = [
  'VIDEO_STORAGE_ENDPOINT',
  'VIDEO_STORAGE_BUCKET',
  'VIDEO_STORAGE_ACCESS_KEY_ID',
  'VIDEO_STORAGE_SECRET_ACCESS_KEY',
] as const;

/**
 * Validated once at boot. A missing or malformed value must kill the process at
 * startup rather than surface as a 500 during a user's analysis.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3002),

    /**
     * zod 4 validates URLs with WHATWG parsing, under which `localhost:5432` is a
     * *valid* URL (scheme `localhost:`). The protocol must be constrained
     * explicitly or a connection string missing its scheme passes validation and
     * fails later at connect time.
     */
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

    /**
     * The interface the API listens on. Loopback by default, so nothing else
     * on the network can reach it. Any other value needs API_TOKEN, unless
     * ALLOW_NETWORK_WITHOUT_TOKEN=true says the port is published on loopback
     * only (the docker compose setup).
     */
    HOST: z.string().min(1).default('127.0.0.1'),
    /**
     * Optional shared secret. When set, every non-public route needs
     * `Authorization: Bearer <API_TOKEN>`. Generate one with
     * `openssl rand -hex 32`.
     */
    API_TOKEN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(16, 'Use at least 16 characters.').optional(),
    ),
    ALLOW_NETWORK_WITHOUT_TOKEN: z.enum(['true', 'false']).default('false'),

    APP_URL: z.url({ protocol: /^https?$/ }),
    /** Comma-separated exact `chrome-extension://<id>` origins. Never a wildcard. */
    EXTENSION_ALLOWED_ORIGINS: z.string().default(''),

    /**
     * Video proposals: recordings go to one S3-compatible bucket (Cloudflare R2,
     * or MinIO locally). Setup: docs/VIDEO-STORAGE-SETUP.md. Setting the
     * endpoint, bucket and both keys turns video on; ffmpeg and ffprobe must
     * then be on PATH (the Docker image ships both).
     */
    VIDEO_STORAGE_ENDPOINT: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.url({ protocol: /^https?$/ }).optional(),
    ),
    VIDEO_STORAGE_REGION: z.string().min(1).default('auto'),
    VIDEO_STORAGE_BUCKET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/)
        .optional(),
    ),
    VIDEO_STORAGE_ACCESS_KEY_ID: optionalSecret,
    VIDEO_STORAGE_SECRET_ACCESS_KEY: optionalSecret,
    VIDEO_STORAGE_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),

    /**
     * Any OpenAI-compatible chat-completions endpoint: OpenAI, OpenRouter,
     * llmgateway.io, a local Ollama (`http://localhost:11434/v1`) or LM Studio.
     */
    AI_BASE_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.url({ protocol: /^https?$/ }).optional(),
    ),
    /** Required, except for a model server on this machine (Ollama, LM Studio). */
    AI_API_KEY: optionalSecret,
    /**
     * Contributors only: write each live AI call to src/ai/__cassettes__ so the
     * test suite can replay it. The prompts embed real profile and CV text.
     */
    AI_RECORD_CASSETTES: z.enum(['on', 'off']).default('off'),

    /**
     * One model id for every AI feature, for providers whose ids differ from
     * the built-in defaults (OpenRouter, Ollama). The per-feature keys below
     * override it; a model picked in Settings > AI models overrides both.
     */
    AI_MODEL: optionalModelId,
    AI_MODEL_PROFILE_ANALYZER_PRIMARY: optionalModelId,
    AI_MODEL_PROFILE_ANALYZER_FALLBACK: optionalModelId,
    AI_MODEL_PROFILE_IMPROVER_PRIMARY: optionalModelId,
    AI_MODEL_PROFILE_IMPROVER_FALLBACK: optionalModelId,
    AI_MODEL_CV_EXTRACTOR_PRIMARY: optionalModelId,
    AI_MODEL_CV_EXTRACTOR_FALLBACK: optionalModelId,
    AI_MODEL_JOB_MATCH_EVALUATOR_PRIMARY: optionalModelId,
    AI_MODEL_JOB_MATCH_EVALUATOR_FALLBACK: optionalModelId,
    AI_MODEL_PROPOSAL_WRITER_PRIMARY: optionalModelId,
    AI_MODEL_PROPOSAL_WRITER_FALLBACK: optionalModelId,
  })
  .superRefine((env, context) => {
    // Video is on when all four are set. Some but not all is a typo, not "off".
    if (VIDEO_STORAGE_KEYS.some((key) => env[key])) {
      for (const key of VIDEO_STORAGE_KEYS) {
        if (env[key]) continue;
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required: video storage needs ${VIDEO_STORAGE_KEYS.join(', ')}.`,
        });
      }
    }
    if (
      env.VIDEO_STORAGE_ENDPOINT?.startsWith('http:') &&
      env.NODE_ENV === 'production' &&
      !isLoopbackUrl(env.VIDEO_STORAGE_ENDPOINT)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['VIDEO_STORAGE_ENDPOINT'],
        message: 'Video storage requires HTTPS, except a local bucket such as MinIO on localhost.',
      });
    }

    if (
      !isLoopbackBindHost(env.HOST) &&
      env.API_TOKEN === undefined &&
      env.ALLOW_NETWORK_WITHOUT_TOKEN !== 'true'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['HOST'],
        message:
          'Listening beyond loopback without API_TOKEN would expose your data and AI key. ' +
          'Set API_TOKEN, or ALLOW_NETWORK_WITHOUT_TOKEN=true if the port is published on 127.0.0.1 only.',
      });
    }

    // The app only runs against a real AI provider. Tests never call one.
    if (env.NODE_ENV === 'test') return;

    if (env.AI_BASE_URL === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['AI_BASE_URL'],
        message:
          'Set your AI provider: AI_BASE_URL and AI_API_KEY. See docs/AI-PROVIDER-SETUP.md (llmgateway.io is recommended).',
      });
    } else if (env.AI_API_KEY === undefined && !isLocalModelServer(env.AI_BASE_URL)) {
      context.addIssue({
        code: 'custom',
        path: ['AI_API_KEY'],
        message: `AI_API_KEY is required for ${env.AI_BASE_URL}. Only a model server on this machine may run without one.`,
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function videoConfigured(
  env: Pick<Env, (typeof VIDEO_STORAGE_KEYS)[number]>,
): boolean {
  return VIDEO_STORAGE_KEYS.every((key) => Boolean(env[key]));
}

/** Ollama, LM Studio and the like, on this machine or the Docker host: no key needed. */
function isLocalModelServer(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return isLoopbackBindHost(host) || host === 'host.docker.internal';
  } catch {
    return false;
  }
}

function isLoopbackUrl(value: string): boolean {
  try {
    return isLoopbackBindHost(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}

/** Splits a comma-separated env value, dropping blanks. */
export function parseList(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
