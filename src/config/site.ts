export const siteConfig = {
  name: "PageSpeedLab.io",
  title: "PageSpeedLab.io",
  description:
    "Practical web performance and Core Web Vitals guides for static content sites.",
  repo: "pagespeedlab-io",
  basePath: "",
  siteUrl: "https://pagespeedlab-io.pages.dev",
  nav: [
    { href: "/", label: "Home" },
    { href: "/blog/", label: "Blog" },
    { href: "/about/", label: "About" }
  ],
  categories: [
    "Web Performance",
    "Core Web Vitals",
    "Image Optimization",
    "Static Publishing",
    "Monitoring"
] as const
};

export type SiteCategory = (typeof siteConfig.categories)[number];
