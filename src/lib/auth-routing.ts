export function authRedirect(pathname: string, authenticated: boolean) {
  if ((pathname.startsWith("/workspace") || pathname === "/onboarding") && !authenticated) return "/login";
  if (pathname === "/login" && authenticated) return "/workspace";
  return null;
}
