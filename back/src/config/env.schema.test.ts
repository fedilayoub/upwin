import { describe, expect, it } from 'vitest';
import { parseList, validateEnv, videoConfigured } from './env.schema';

const valid = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/upwin',
  APP_URL: 'http://localhost:3000',
  AI_BASE_URL: 'https://api.llmgateway.io/v1',
  AI_API_KEY: 'provider-key',
};

describe('validateEnv', () => {
  it('applies defaults for optional values', () => {
    const env = validateEnv({ ...valid });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3002);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.API_TOKEN).toBeUndefined();
    expect(env.ALLOW_NETWORK_WITHOUT_TOKEN).toBe('false');
    expect(env.EXTENSION_ALLOWED_ORIGINS).toBe('');
    expect(env.AI_RECORD_CASSETTES).toBe('off');
  });

  it('coerces PORT from the string the environment always provides', () => {
    expect(validateEnv({ ...valid, PORT: '4000' }).PORT).toBe(4000);
  });

  it('treats blank optional AI values and model ids as unset', () => {
    const env = validateEnv({
      ...valid,
      NODE_ENV: 'test',
      AI_API_KEY: '',
      AI_BASE_URL: '',
      AI_MODEL: '',
      AI_MODEL_PROFILE_ANALYZER_PRIMARY: '',
      AI_MODEL_PROFILE_ANALYZER_FALLBACK: '',
      AI_MODEL_PROFILE_IMPROVER_PRIMARY: '',
      AI_MODEL_PROFILE_IMPROVER_FALLBACK: '',
      AI_MODEL_CV_EXTRACTOR_PRIMARY: '',
      AI_MODEL_CV_EXTRACTOR_FALLBACK: '',
      AI_MODEL_JOB_MATCH_EVALUATOR_PRIMARY: '',
      AI_MODEL_JOB_MATCH_EVALUATOR_FALLBACK: '',
      AI_MODEL_PROPOSAL_WRITER_PRIMARY: '',
      AI_MODEL_PROPOSAL_WRITER_FALLBACK: '',
    });

    expect(env.AI_API_KEY).toBeUndefined();
    expect(env.AI_BASE_URL).toBeUndefined();
    expect(env.AI_MODEL).toBeUndefined();
    expect(env.AI_MODEL_PROFILE_ANALYZER_PRIMARY).toBeUndefined();
    expect(env.AI_MODEL_CV_EXTRACTOR_FALLBACK).toBeUndefined();
    expect(env.AI_MODEL_PROPOSAL_WRITER_PRIMARY).toBeUndefined();
  });

  it.each(['openai/gpt-4.1-nano', 'llama3.1:8b', 'gpt-4.1-nano'])(
    'accepts the model id %s as the endpoint names it',
    (modelId) => {
      expect(
        validateEnv({ ...valid, AI_MODEL_PROFILE_ANALYZER_PRIMARY: modelId })
          .AI_MODEL_PROFILE_ANALYZER_PRIMARY,
      ).toBe(modelId);
    },
  );

  it('refuses to start without an AI provider, pointing at the guide', () => {
    expect(() =>
      validateEnv({ ...valid, AI_BASE_URL: '', AI_API_KEY: '' }),
    ).toThrowError(/AI_BASE_URL: Set your AI provider[\s\S]*AI-PROVIDER-SETUP/);
    expect(() =>
      validateEnv({ ...valid, NODE_ENV: 'production', AI_BASE_URL: '' }),
    ).toThrowError(/AI_BASE_URL/);
  });

  it('requires a key for a remote provider', () => {
    expect(() => validateEnv({ ...valid, AI_API_KEY: '' })).toThrowError(
      /AI_API_KEY is required for https:\/\/api\.llmgateway\.io\/v1/,
    );
  });

  it.each([
    'http://localhost:11434/v1',
    'http://127.0.0.1:1234/v1',
    'http://host.docker.internal:11434/v1',
  ])('lets a model server on this machine run without a key: %s', (url) => {
    expect(
      validateEnv({ ...valid, AI_BASE_URL: url, AI_API_KEY: '' }).AI_API_KEY,
    ).toBeUndefined();
  });

  it('needs no provider in tests, which never call one', () => {
    expect(
      validateEnv({ ...valid, NODE_ENV: 'test', AI_BASE_URL: '', AI_API_KEY: '' })
        .NODE_ENV,
    ).toBe('test');
  });

  it('ignores a leftover AI_MODE: the app always calls the provider', () => {
    expect(validateEnv({ ...valid, AI_MODE: 'fake' })).not.toHaveProperty('AI_MODE');
  });

  it('reports every missing required value at once', () => {
    expect(() => validateEnv({})).toThrowError(/DATABASE_URL[\s\S]*APP_URL/);
  });

  it('rejects a malformed database url instead of failing later at connect time', () => {
    expect(() =>
      validateEnv({ ...valid, DATABASE_URL: 'localhost:5432' }),
    ).toThrowError(/DATABASE_URL/);
  });

  describe('network exposure', () => {
    it.each(['127.0.0.1', 'localhost', '::1'])(
      'allows the loopback host %s without a token',
      (host) => {
        expect(validateEnv({ ...valid, HOST: host }).HOST).toBe(host);
      },
    );

    it('refuses to listen beyond loopback without API_TOKEN', () => {
      expect(() => validateEnv({ ...valid, HOST: '0.0.0.0' })).toThrowError(
        /HOST: Listening beyond loopback without API_TOKEN/,
      );
    });

    it('allows a network host with API_TOKEN', () => {
      expect(
        validateEnv({
          ...valid,
          HOST: '0.0.0.0',
          API_TOKEN: 'a-long-enough-token-value',
        }).HOST,
      ).toBe('0.0.0.0');
    });

    it('allows a network host when the port is declared loopback-only', () => {
      expect(
        validateEnv({
          ...valid,
          HOST: '0.0.0.0',
          ALLOW_NETWORK_WITHOUT_TOKEN: 'true',
        }).HOST,
      ).toBe('0.0.0.0');
    });

    it('rejects a short API_TOKEN and treats a blank one as unset', () => {
      expect(() => validateEnv({ ...valid, API_TOKEN: 'short' })).toThrowError(
        /API_TOKEN: Use at least 16 characters/,
      );
      expect(validateEnv({ ...valid, API_TOKEN: '' }).API_TOKEN).toBeUndefined();
    });
  });
});

describe('video settings', () => {
  const storage = {
    VIDEO_STORAGE_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    VIDEO_STORAGE_BUCKET: 'upwin-videos',
    VIDEO_STORAGE_ACCESS_KEY_ID: 'key',
    VIDEO_STORAGE_SECRET_ACCESS_KEY: 'secret',
  };

  it('is off without storage and on once all four storage keys are set', () => {
    expect(videoConfigured(validateEnv(valid))).toBe(false);
    expect(videoConfigured(validateEnv({ ...valid, ...storage }))).toBe(true);
  });

  it.each([
    'VIDEO_STORAGE_ENDPOINT',
    'VIDEO_STORAGE_BUCKET',
    'VIDEO_STORAGE_ACCESS_KEY_ID',
    'VIDEO_STORAGE_SECRET_ACCESS_KEY',
  ])('requires %s once any storage key is set', (key) => {
    expect(() => validateEnv({ ...valid, ...storage, [key]: '' })).toThrow(
      new RegExp(`${key}: ${key} is required`),
    );
  });

  it('requires HTTPS storage in production, except a bucket on localhost', () => {
    expect(() =>
      validateEnv({
        ...valid,
        ...storage,
        NODE_ENV: 'production',
        VIDEO_STORAGE_ENDPOINT: 'http://minio.example.com:9000',
      }),
    ).toThrow(/VIDEO_STORAGE_ENDPOINT/);
    expect(
      validateEnv({
        ...valid,
        ...storage,
        NODE_ENV: 'production',
        VIDEO_STORAGE_ENDPOINT: 'http://localhost:9000',
      }).VIDEO_STORAGE_ENDPOINT,
    ).toBe('http://localhost:9000');
  });
});

describe('parseList', () => {
  it('trims entries and drops blanks', () => {
    expect(parseList(' a , ,b ')).toEqual(['a', 'b']);
  });

  it('returns an empty list for an absent value', () => {
    expect(parseList(undefined)).toEqual([]);
  });
});
