import type {
  SocialLink,
  SocialLinkInput,
  SocialPlatform,
  UpdateNetworkingRequest,
} from "./networking.types.js";

const PLATFORM_DOMAINS: Partial<Record<SocialPlatform, readonly string[]>> = {
  linkedin: ["linkedin.com"],
  instagram: ["instagram.com"],
  github: ["github.com"],
  x: ["x.com", "twitter.com"],
};

export type SocialLinkValidation =
  | { status: "ok" }
  | { status: "invalid_url" }
  | { status: "invalid_domain" }
  | { status: "label_required" };

export type NetworkingSelectionValidation =
  | { status: "ok" }
  | { status: "too_many_links" }
  | { status: "invalid_link"; reason: Exclude<SocialLinkValidation["status"], "ok"> };

const parsedHttpUrl = (value: string): URL | null => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
};

const matchesDomain = (hostname: string, expected: string): boolean =>
  hostname === expected || hostname.endsWith(`.${expected}`);

export const isHttpUrl = (value: string): boolean => parsedHttpUrl(value) !== null;

export const urlBelongsToPlatform = (
  platform: SocialPlatform,
  value: string,
): boolean => {
  const expectedDomains = PLATFORM_DOMAINS[platform];
  if (!expectedDomains) return true;

  const parsed = parsedHttpUrl(value);
  if (!parsed) return false;
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  return expectedDomains.some((domain) => matchesDomain(hostname, domain));
};

export const validateSocialLink = (link: SocialLinkInput): SocialLinkValidation => {
  if (!isHttpUrl(link.url)) return { status: "invalid_url" };
  if (!urlBelongsToPlatform(link.platform, link.url)) return { status: "invalid_domain" };

  if (
    (link.platform === "website" || link.platform === "other") &&
    (typeof link.label !== "string" || link.label.trim().length === 0)
  ) {
    return { status: "label_required" };
  }

  return { status: "ok" };
};

export const validateNetworkingSelection = (
  input: UpdateNetworkingRequest,
): NetworkingSelectionValidation => {
  if (input.links.length > 1) return { status: "too_many_links" };

  const link = input.links[0];
  if (!link) return { status: "ok" };

  const linkValidation = validateSocialLink(link);
  return linkValidation.status === "ok"
    ? { status: "ok" }
    : { status: "invalid_link", reason: linkValidation.status };
};

export const normalizeSocialLink = (link: SocialLinkInput): SocialLink => {
  const label = typeof link.label === "string" ? link.label.trim() : "";
  return {
    platform: link.platform,
    url: link.url.trim(),
    label: label.length > 0 ? label : null,
  };
};
