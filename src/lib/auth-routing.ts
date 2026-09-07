export function safeAuthDestination(value: string | null) {
  // Backslashes and control characters can be normalized into external URLs.
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return "/workspace";
  return value;
}

export function authRedirect(pathname: string, authenticated: boolean) {
  if ((pathname.startsWith("/workspace") || pathname === "/driver" || pathname === "/onboarding" || pathname === "/reset-password") && !authenticated) return "/login";
  if (pathname === "/login" && authenticated) return "/workspace";
  return null;
}
