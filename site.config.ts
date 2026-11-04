export interface FontRoleConfig {
  family: string;
  source: 'fontsource' | 'local' | 'system';
  weights: (string | number)[];
  fallback: string;
  localPath?: string;
}

export interface SiteConfig {
  name: string;
  tagline: string;
  header: string;
  author: string;
  description: string;
  githubUser: string;
  repoName: string;
  // If true: https://<githubUser>.github.io/<repoName>
  // If false (custom domain or root user page): https://<githubUser>.github.io or customUrl
  isSubpathDeploy: boolean;
  customDomain?: string;
  defaultShareImage: string;
  verification?: {
    google?: string;
    bing?: string;
  };
  socials: {
    github?: string;
    x?: string;
    linkedin?: string;
    youtube?: string;
    email?: string;
    rss?: boolean;
  };
  fonts: {
    baseFontSize: string;
    baseLineHeight: string;
    contentWidth: string;
    heading: FontRoleConfig;
    body: FontRoleConfig;
    code: FontRoleConfig;
  };
  comments: {
    enabled: boolean;
    provider: 'giscus';
    repo: string;
    repoId: string;
    category: string;
    categoryId: string;
    mapping: 'pathname';
    reactionsEnabled: boolean;
    emitMetadata: boolean;
    theme: string;
  };
  analytics: {
    enabled: boolean;
    provider?: 'umami' | 'plausible' | 'fathom';
    websiteId?: string;
    host?: string;
  };
}

export const siteConfig: SiteConfig = {
  name: "Mo's Articles",
  tagline: "Software Engineering & technical Writing",
  header: "A place just for me",
  author: "Mohamed Khairy",
  description:
    "",
  githubUser: "Mo-1Kh",
  repoName: "My-Articles",
  isSubpathDeploy: true,
  customDomain: "",
  defaultShareImage: "/og-default.png",
  verification: {
    google: "",
    bing: "",
  },
  socials: {
    github: "https://github.com/Mo-1Kh",
    x: "https://x.com/Mo_1Khairy",
    linkedin: "https://www.linkedin.com/in/mohamed-khairy-swe/",
    youtube: "",
    email: "mohamedkhairy.swe@gmail.com",
    rss: true,
  },
  fonts: {
    baseFontSize: "17px",
    baseLineHeight: "1.75",
    contentWidth: "700px",
    heading: {
      family: "Fraunces",
      source: "fontsource",
      weights: [600, 700],
      fallback: "Georgia, 'Times New Roman', serif",
    },
    body: {
      family: "Source Serif 4",
      source: "fontsource",
      weights: [400, 600],
      fallback: "'Charter', 'Bitstream Charter', 'Sitka Text', Cambria, serif",
    },
    code: {
      family: "JetBrains Mono",
      source: "fontsource",
      weights: [400, 500],
      fallback: "'Courier New', Courier, monospace",
    },
  },
  comments: {
    enabled: true,
    provider: "giscus",
    repo: "Mo-1Kh/My-Articles",
    repoId: "R_kgDOVh2KMg",
    category: "Announcements",
    categoryId: "DIC_kwDOVh2KMs4DKWTg",
    mapping: "pathname",
    reactionsEnabled: true,
    emitMetadata: false,
    theme: "preferred_color_scheme",
  },
  analytics: {
    enabled: false,
  },
};

/**
 * Returns the canonical origin URL based on config.
 */
export function getSiteOrigin(): string {
  if (siteConfig.customDomain && siteConfig.customDomain.trim() !== "") {
    return siteConfig.customDomain.startsWith("http")
      ? siteConfig.customDomain
      : `https://${siteConfig.customDomain}`;
  }
  return `https://${siteConfig.githubUser}.github.io`;
}

/**
 * Returns the base path prefix.
 */
declare const process: any;

export function getBasePath(): string {
  // During local development (astro dev), serve at root for clean localhost:4321 URLs
  // unless explicitly forced via SUBPATH=true
  if (typeof process !== "undefined" && process?.env?.NODE_ENV !== "production" && !process?.env?.SUBPATH) {
    return "";
  }
  if (siteConfig.customDomain && siteConfig.customDomain.trim() !== "") {
    return "";
  }
  return siteConfig.isSubpathDeploy ? `/${siteConfig.repoName}` : "";
}

/**
 * Helper to generate an absolute route with base path included (idempotent if base is already prefixed).
 */
export function getPath(path: string): string {
  const base = getBasePath();
  let cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (base !== "" && (cleanPath === base || cleanPath.startsWith(`${base}/`))) {
    cleanPath = cleanPath.slice(base.length) || "/";
  }
  if (cleanPath === "/" && base !== "") {
    return `${base}/`;
  }
  return `${base}${cleanPath}`;
}

/**
 * Helper to generate a fully-qualified canonical URL including origin and base path.
 */
export function getCanonicalUrl(path: string): string {
  const origin = getSiteOrigin();
  const fullPath = getPath(path);
  return `${origin}${fullPath}`;
}

