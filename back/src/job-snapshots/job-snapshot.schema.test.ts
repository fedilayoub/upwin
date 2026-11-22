import { describe, expect, it } from 'vitest';
import {
  JOB_SNAPSHOT_CAPS,
  parseJobSnapshotRequest,
} from './job-snapshot.schema';

describe('job snapshot schema', () => {
  it('accepts the frozen contract shape', () => {
    expect(
      parseJobSnapshotRequest({ snapshot: validSnapshot() }).snapshot,
    ).toMatchObject({
      source: 'upwork-payload',
      job: {
        ciphertext: '~0def456',
        engagement: { budgetType: 'hourly' },
        questions: [],
      },
    });
  });

  it('truncates over-cap content and reports every affected path', () => {
    const snapshot = validSnapshot({
      description: 'x'.repeat(JOB_SNAPSHOT_CAPS.description + 1),
      skills: Array.from(
        { length: JOB_SNAPSHOT_CAPS.skills + 1 },
        (_, index) => ({
          name: `Skill ${index}`,
          relevance: 'unknown',
        }),
      ),
    });
    const result = parseJobSnapshotRequest({ snapshot });

    expect(result.snapshot.job.description).toHaveLength(
      JOB_SNAPSHOT_CAPS.description,
    );
    expect(result.snapshot.job.skills).toHaveLength(JOB_SNAPSHOT_CAPS.skills);
    expect(result.truncatedFields).toEqual(['job.skills', 'job.description']);
  });

  it('rejects HTML-shaped extras and missing required text', () => {
    expect(() =>
      parseJobSnapshotRequest({
        snapshot: validSnapshot({ description: undefined }),
      }),
    ).toThrow('The job snapshot is invalid');
    expect(() =>
      parseJobSnapshotRequest({
        snapshot: { ...validSnapshot(), rawHtml: '<article>private</article>' },
      }),
    ).toThrow('The job snapshot is invalid');
  });
});

function validSnapshot(jobOverrides: Record<string, unknown> = {}) {
  return {
    source: 'upwork-payload',
    capturedAt: '2026-08-23T12:00:00.000Z',
    job: {
      ciphertext: '~0def456',
      url: 'https://www.upwork.com/jobs/~0def456',
      title: 'Synthetic job',
      description: 'Synthetic job description',
      postedAt: '2026-08-20T12:00:00.000Z',
      category: 'Web Development',
      categoryGroup: 'Development & IT',
      engagement: {
        budgetType: 'hourly',
        hourlyBudget: { min: 15, max: 30, currency: 'USD' },
        workload: 'Less than 30 hrs/week',
        durationLabel: 'Less than 1 month',
        experienceLevel: 'intermediate',
        projectType: 'One-time project',
      },
      skills: [
        { name: 'TypeScript', relevance: 'mandatory' },
        { name: 'Next.js', relevance: 'nice-to-have' },
      ],
      questions: [],
      client: {
        country: 'Exampleland',
        paymentVerified: true,
        rating: 4.8,
        reviewCount: 12,
      },
      activity: { applicants: 12, interviewing: 2, hired: 0 },
      ...jobOverrides,
    },
  };
}
