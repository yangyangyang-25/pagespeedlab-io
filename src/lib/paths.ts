const base = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export function sitePath(path = "/") {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return normalized ? `${base}${normalized}` : base;
}
