export const dynamic = "force-dynamic";

import { adminLogin } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div style={{ maxWidth: 400 }}>
      <h1>Admin Login</h1>
      {error && (
        <p style={{ color: "#670f01", background: "#f7e8e4", padding: "0.6rem 0.8rem", borderRadius: 4 }}>
          That didn&apos;t work. Check the token and try again.
        </p>
      )}
      <form action={adminLogin} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Admin token
          <input
            name="token"
            type="password"
            required
            autoComplete="off"
            style={{
              display: "block",
              width: "100%",
              padding: "0.5rem",
              marginTop: "0.25rem",
              border: "1px solid #ccc",
              borderRadius: 4,
            }}
          />
        </label>
        <button
          type="submit"
          style={{
            padding: "0.6rem 1.2rem",
            background: "#3a2a1a",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            width: "fit-content",
          }}
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
