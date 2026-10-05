export const SOCIAL_PLATFORMS = [
  "linkedin",
  "instagram",
  "github",
  "x",
  "website",
  "other",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialLink = {
  platform: SocialPlatform;
  url: string;
  label: string | null;
};

export type SocialLinkInput = {
  platform: SocialPlatform;
  url: string;
  label?: string | null;
};

export type NetworkingCard = {
  optIn: boolean;
  links: SocialLink[];
};

export type PublicNetworkingCard = NetworkingCard & {
  owner: {
    userId: number;
    fullName: string;
    primaryDetail: string;
    secondaryDetail: string;
    roleLabel: string;
  };
};

export type UpdateNetworkingRequest = {
  optIn: boolean;
  links: SocialLinkInput[];
};
