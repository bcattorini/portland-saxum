import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { allowedSection, homePath } from "@/lib/users";

// Refreshes the Supabase session on every request and gates access:
// unauthenticated users are redirected to /login (except the login page itself).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with Supabase (don't trust getSession here).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith("/login");
  const isAuthRoute = path.startsWith("/auth"); // confirm link + set-password flow

  if (!user && !isLogin && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = homePath(user.email);
    return NextResponse.redirect(url);
  }
  // Restricted roles (viewer → /permisos, pagos → /pagos) can only see their section.
  const allowed = user ? allowedSection(user.email) : null;
  if (user && allowed && !isLogin && !isAuthRoute && !path.startsWith(allowed)) {
    const url = request.nextUrl.clone();
    url.pathname = allowed;
    return NextResponse.redirect(url);
  }

  return response;
}
