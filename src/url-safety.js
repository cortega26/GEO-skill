const HTTP_SCHEMES = new Set(["http:", "https:"]);

export function normalizeHref(value) {
  return String(value ?? "").trim();
}

export function hasUriScheme(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(normalizeHref(value));
}

export function isHttpHref(value) {
  const href = normalizeHref(value);
  try {
    return HTTP_SCHEMES.has(new URL(href).protocol);
  } catch {
    return /^https?:\/\//i.test(href);
  }
}

export function isFragmentHref(value) {
  return normalizeHref(value).startsWith("#");
}

export function hasUnsafeHrefScheme(value) {
  const href = normalizeHref(value);
  if (!hasUriScheme(href)) return false;
  try {
    return !HTTP_SCHEMES.has(new URL(href).protocol);
  } catch {
    return true;
  }
}
