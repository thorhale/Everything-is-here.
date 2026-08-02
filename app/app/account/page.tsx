// The account page: sign in with a provider, or see who you're signed in as.
// Dynamic because it reads the session cookie; the rest of the site stays
// static, and the header just links here rather than reading auth itself
// (which would opt every page out of static rendering).
export const dynamic = "force-dynamic";

import { auth, signIn, signOut, enabledProviders } from "@/auth";

export const metadata = {
  title: "Account — WortHogg",
  description: "Sign in to save recipes and brew logs.",
};

const PROVIDER_LABEL: Record<string, string> = {
  google: "Continue with Google",
  apple: "Continue with Apple",
};

const btn: React.CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 320,
  padding: "0.65rem 1rem",
  marginBottom: "0.6rem",
  border: "1px solid var(--wh-border)",
  borderRadius: 6,
  background: "var(--wh-bg-soft)",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
};

export default async function AccountPage() {
  const session = await auth();

  if (session?.user) {
    return (
      <div style={{ maxWidth: 480 }}>
        <h1>Your account</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1rem 0" }}>
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              width={48}
              height={48}
              style={{ borderRadius: "50%" }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{session.user.name ?? "Signed in"}</div>
            {session.user.email && (
              <div style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>{session.user.email}</div>
            )}
          </div>
        </div>
        <p style={{ color: "var(--wh-text-light)", fontSize: "0.9rem" }}>
          Saved recipes and brew logs will live here. Signing in reserves your account; the features
          that fill it are on the way.
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/account" });
          }}
        >
          <button type="submit" style={{ ...btn, maxWidth: 200 }}>
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1>Sign in</h1>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 400 }}>
        Sign in to save recipes and brew logs. We only ever see the name and email your provider
        shares — no password to set or forget.
      </p>
      {enabledProviders.length === 0 ? (
        <p
          style={{
            fontSize: "0.9rem",
            background: "var(--wh-bg-soft)",
            border: "1px solid var(--wh-border)",
            borderRadius: 8,
            padding: "0.8rem 1rem",
            marginTop: "1rem",
          }}
        >
          Sign-in isn&apos;t switched on in this environment yet — no OAuth provider is configured.
          Once Google or Apple credentials are set (see <code>docs/accounts.md</code>), the buttons
          appear here automatically.
        </p>
      ) : (
        <div style={{ marginTop: "1.25rem" }}>
          {enabledProviders.map((p) => (
            <form
              key={p}
              action={async () => {
                "use server";
                await signIn(p, { redirectTo: "/account" });
              }}
            >
              <button type="submit" style={btn}>
                {PROVIDER_LABEL[p] ?? `Continue with ${p}`}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
