import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const nonEmptyText = z.string().trim().min(1).max(5_000);
const optionalText = nonEmptyText.optional();
const stringList = z.array(nonEmptyText).max(100);

export const experienceRoleSchema = z
  .object({
    title: optionalText,
    company: optionalText,
    period: optionalText,
    description: optionalText,
  })
  .strict();

export const freelancerExperienceSchema = z
  .object({
    years: z.number().finite().nonnegative().max(100).optional(),
    roles: z.array(experienceRoleSchema).max(100),
  })
  .strict();

export const portfolioProjectSchema = z
  .object({
    title: optionalText,
    description: optionalText,
    skills: stringList,
    url: z.url({ protocol: /^https?$/ }).optional(),
  })
  .strict();

export const freelancerPreferencesSchema = z
  .object({
    tone: optionalText,
    services: stringList.optional(),
  })
  .strict();

export const freelancerPositioningSchema = z
  .object({
    targetRole: optionalText,
    targetClients: stringList.optional(),
    targetIndustries: stringList.optional(),
    targetRate: z.number().finite().nonnegative().max(1_000_000).optional(),
  })
  .strict();

export const freelancerContextFieldsSchema = z
  .object({
    experience: freelancerExperienceSchema,
    skills: stringList,
    portfolio: z.array(portfolioProjectSchema).max(100),
    preferences: freelancerPreferencesSchema,
    positioning: freelancerPositioningSchema,
  })
  .strict();

export const updateFreelancerContextSchema = freelancerContextFieldsSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field is required.',
  );

export type FreelancerContextFields = z.output<
  typeof freelancerContextFieldsSchema
>;
export type FreelancerExperience = FreelancerContextFields['experience'];
export type FreelancerSkills = FreelancerContextFields['skills'];
export type FreelancerPortfolio = FreelancerContextFields['portfolio'];
export type FreelancerPreferences = FreelancerContextFields['preferences'];
export type FreelancerPositioning = FreelancerContextFields['positioning'];

export class CreateFreelancerContextDto extends createZodDto(
  freelancerContextFieldsSchema,
) {}

export class UpdateFreelancerContextDto extends createZodDto(
  updateFreelancerContextSchema,
) {}
