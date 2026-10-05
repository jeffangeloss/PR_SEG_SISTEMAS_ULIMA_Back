import { z } from "zod";

export const sectionIdParamSchema = z.object({
  sectionId: z.coerce.number().int().positive(),
});

export const announcementIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(5000),
});

export const updateAnnouncementSchema = createAnnouncementSchema;

export type CreateAnnouncementBody = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementBody = z.infer<typeof updateAnnouncementSchema>;
