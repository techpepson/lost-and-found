// Only app-owned paths are accepted; arbitrary external links never become routes.
export function appPath(path: string): string {
  try {
    const url = new URL(path, "lostandfound://app");
    let route = url.pathname;
    if (
      url.protocol === "lostandfound:" &&
      url.hostname &&
      url.hostname !== "app"
    )
      route = "/" + url.hostname + route;
    if (route.startsWith("/--/")) route = route.slice(3);
    if (/^\/(item|claim)\/[a-zA-Z0-9_-]+$/.test(route)) return route;
    if (
      [
        "/",
        "/post",
        "/profile",
        "/updates",
        "/notifications",
        "/admin",
        "/help",
        "/auth/login",
        "/auth/verify",
        "/auth/reset",
      ].includes(route)
    )
      return route;
  } catch {
    /* Unknown provider links go to the home screen. */
  }
  return "/";
}
