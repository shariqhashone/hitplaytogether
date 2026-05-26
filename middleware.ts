import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublic = createRouteMatcher([
  "/",
  "/login",
  "/signup",
  "/admin/login",
]);
const isAdmin = createRouteMatcher(["/admin(.*)"]);

export default convexAuthNextjsMiddleware(async (req, { convexAuth }) => {
  const authed = await convexAuth.isAuthenticated();
  if (isAdmin(req) && !req.nextUrl.pathname.startsWith("/admin/login") && !authed) {
    return nextjsMiddlewareRedirect(req, "/admin/login");
  }
  if (!isPublic(req) && !authed) {
    return nextjsMiddlewareRedirect(req, "/login");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
