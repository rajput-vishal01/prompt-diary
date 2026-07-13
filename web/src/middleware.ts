import { NextRequest, NextResponse } from "next/server";

// CORS for the chrome extension calling /api/* with a bearer token.
// Extension origins are chrome-extension://<id>; cookies are not used
// on these routes so allowing the extension origin is safe.
const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  // without this the extension can't READ the session token header on
  // sign-in — cross-origin responses hide non-safelisted headers
  "Access-Control-Expose-Headers": "set-auth-token",
  "Access-Control-Max-Age": "86400",
};

function hasSessionCookie(request: NextRequest): boolean {
  // better-auth cookie is __Secure- prefixed on https (prod)
  return (
    !!request.cookies.get("better-auth.session_token") ||
    !!request.cookies.get("__Secure-better-auth.session_token")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // signed-in users skip the marketing/login pages entirely
  if ((pathname === "/" || pathname === "/login") && hasSessionCookie(request)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const origin = request.headers.get("origin") ?? "";
  const isExtension = origin.startsWith("chrome-extension://");

  if (request.method === "OPTIONS" && isExtension) {
    return new NextResponse(null, {
      status: 204,
      headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": origin },
    });
  }

  const response = NextResponse.next();
  if (isExtension) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      response.headers.set(k, v);
    }
  }
  return response;
}

export const config = {
  matcher: ["/", "/login", "/api/:path*"],
};
