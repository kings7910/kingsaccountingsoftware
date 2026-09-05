export function authRedirect(pathname: string, authenticated: boolean) {
  if ((pathname.startsWith("/workspace") || pathname === "/driver" || pathname === "/onboarding" || pathname === "/reset-password") && !authenticated) return "/login";
  if (pathname === "/login" && authenticated) return "/workspace";
  return null;
}
