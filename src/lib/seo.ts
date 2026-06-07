import { siteConfig } from "../config/site";

export function withBase(pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return normalized === "/" ? `${siteConfig.basePath}/` : `${siteConfig.basePath}${normalized}`;
}

export function absoluteUrl(pathname: string) {
  return new URL(withBase(pathname), siteConfig.siteUrl).toString();
}

export function pageTitle(title?: string) {
  return title ? `${title} | ${siteConfig.title}` : siteConfig.title;
}
