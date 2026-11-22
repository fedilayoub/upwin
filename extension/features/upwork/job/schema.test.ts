import { describe, expect, it } from 'vitest';
import { JOB_SNAPSHOT_CAPS, parseJobSnapshot } from './schema';

describe('JobSnapshot schema', () => {
  it('truncates over-cap text and reports the affected path', () => {
    const result = parseJobSnapshot(
      snapshot({ description: 'x'.repeat(JOB_SNAPSHOT_CAPS.description + 1) }),
    );

    expect(result.snapshot.job.description).toHaveLength(
      JOB_SNAPSHOT_CAPS.description,
    );
    expect(result.truncatedFields).toEqual(['job.description']);
  });

  it('truncates questions and arrays at the contract caps', () => {
    const result = parseJobSnapshot(
      snapshot({
        skills: Array.from(
          { length: JOB_SNAPSHOT_CAPS.skills + 1 },
          (_, index) => ({
            name: `Skill ${index}`,
            relevance: 'unknown',
          }),
        ),
        questions: Array.from(
          { length: JOB_SNAPSHOT_CAPS.questions + 1 },
          (_, position) => ({
            position,
            question:
              position === 0
                ? 'q'.repeat(JOB_SNAPSHOT_CAPS.question + 1)
                : `Question ${position}`,
          }),
        ),
      }),
    );

    expect(result.snapshot.job.skills).toHaveLength(JOB_SNAPSHOT_CAPS.skills);
    expect(result.snapshot.job.questions).toHaveLength(
      JOB_SNAPSHOT_CAPS.questions,
    );
    expect(result.snapshot.job.questions[0]?.question).toHaveLength(
      JOB_SNAPSHOT_CAPS.question,
    );
    expect(result.truncatedFields).toEqual([
      'job.questions[0].question',
      'job.skills',
      'job.questions',
    ]);
  });

  it('rejects a missing required description without producing a snapshot', () => {
    const input = snapshot();
    const { description: _description, ...jobWithoutDescription } = input.job;

    expect(() =>
      parseJobSnapshot({ ...input, job: jobWithoutDescription }),
    ).toThrow('We could not read this job');
  });
});

function snapshot(jobOverrides: Record<string, unknown> = {}) {
  return {
    source: 'upwork-dom',
    capturedAt: '2026-08-23T12:00:00.000Z',
    job: {
      ciphertext: '~0def456',
      url: 'https://www.upwork.com/jobs/~0def456',
      title: 'Synthetic job',
      description: 'Synthetic description',
      engagement: { budgetType: 'unknown' },
      skills: [],
      questions: [],
      client: { paymentVerified: null },
      activity: {},
      ...jobOverrides,
    },
  };
}
