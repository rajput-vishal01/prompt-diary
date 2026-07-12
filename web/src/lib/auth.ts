import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";

const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true, // registering IS signing in — no double form fill
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // ponytail: dev logs the link; wire a real provider (Resend/SES) for prod.
      if (process.env.NODE_ENV !== "production") {
        console.log(`[verify-email] ${user.email} -> ${url}`);
        return;
      }
      // TODO(prod): send via Resend once RESEND_API_KEY is configured
      console.warn(`[verify-email] no mail provider configured for ${user.email}`);
    },
  },
  ...(googleEnabled && {
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },
  }),
  // bearer(): lets the chrome extension authenticate with
  // "Authorization: Bearer <token>" instead of cookies
  plugins: [bearer()],
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin") ?? "";
    // the extension's origin is chrome-extension://<generated-id>
    if (origin.startsWith("chrome-extension://")) return [origin];
    // dev: trust any localhost port (next dev hops ports when 3000 is taken)
    if (
      process.env.NODE_ENV !== "production" &&
      /^http:\/\/localhost:\d+$/.test(origin)
    ) {
      return [origin];
    }
    return [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"];
  },
});

export type Session = typeof auth.$Infer.Session;
