import { z } from "zod";
import {
  isHttpUrl,
  urlBelongsToPlatform,
  validateSocialLink,
} from "./networking.logic.js";
import { SOCIAL_PLATFORMS } from "./networking.types.js";

export const socialLinkSchema = z
  .object({
    platform: z.enum(SOCIAL_PLATFORMS),
    url: z
      .string()
      .trim()
      .min(1, "La URL es obligatoria.")
      .max(255, "La URL no puede superar 255 caracteres.")
      .url("La URL debe ser absoluta y válida."),
    label: z
      .string()
      .trim()
      .min(1, "La etiqueta no puede estar vacía.")
      .max(80, "La etiqueta no puede superar 80 caracteres.")
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((link, ctx) => {
    if (!isHttpUrl(link.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "La URL debe usar http:// o https://.",
      });
      return;
    }

    if (!urlBelongsToPlatform(link.platform, link.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "La URL no corresponde a la plataforma seleccionada.",
      });
    }

    if (validateSocialLink(link).status === "label_required") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["label"],
        message: "La etiqueta es obligatoria para sitio web u otra red.",
      });
    }
  });

export const updateNetworkingSchema = z
  .object({
    optIn: z.boolean(),
    links: z
      .array(socialLinkSchema)
      .max(1, "El carnet admite una sola red social."),
  })
  .strict();

export type UpdateNetworkingBody = z.infer<typeof updateNetworkingSchema>;
