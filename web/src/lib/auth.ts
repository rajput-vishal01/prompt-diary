import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { destroyAllUserImages } from "./cloudinary";
import { isAllowedExtensionOrigin } from "./extension-origin";
import { canSendMail, sendMail, verificationEmailHtml } from "./mailer";

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
  user: {
    deleteUser: {
      enabled: true,
      // DB rows cascade via FKs; Cloudinary doesn't — sweep every asset we
      // know about (prompt panes, thread screenshots, avatar) before the rows
      // that reference them disappear
      beforeDelete: async (user) => {
        const [rows, threadRows] = await Promise.all([
          db
            .select({ a: schema.prompts.imageBefore, b: schema.prompts.imageAfter })
            .from(schema.prompts)
            .where(eq(schema.prompts.userId, user.id)),
          db
            .select({ a: schema.threads.finalImage })
            .from(schema.threads)
            .where(eq(schema.threads.userId, user.id)),
        ]);
        await destroyAllUserImages(user.id, [
          user.image,
          ...rows.flatMap((r) => [r.a, r.b]),
          ...threadRows.map((r) => r.a),
        ]);
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (canSendMail) {
        await sendMail({
          to: user.email,
          subject: "Verify your Prompt Diary email",
          html: verificationEmailHtml(user.name, url),
        });
        return;
      }
      // no GMAIL_USER/GMAIL_APP_PASSWORD configured — log the link in dev
      if (process.env.NODE_ENV !== "production") {
        console.log(`[verify-email] ${user.email} -> ${url}`);
      } else {
        console.warn(`[verify-email] mail not configured, cannot email ${user.email}`);
      }
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
  session: {
    // cache the session in a signed cookie for 5 min — without this EVERY
    // api call does a session lookup in the DB (a full Neon roundtrip in
    // prod), which is the single biggest source of perceived slowness
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  // bearer(): lets the chrome extension authenticate with
  // "Authorization: Bearer <token>" instead of cookies
  plugins: [bearer()],
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin") ?? "";
    // chrome-extension://<id> — any id in dev, EXTENSION_IDS-pinned in prod
    if (isAllowedExtensionOrigin(origin)) return [origin];
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
