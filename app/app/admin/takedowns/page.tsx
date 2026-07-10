import { prisma } from "@/lib/db";
import { approveTakedown, rejectTakedown } from "./actions";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

// NOTE: this is a minimal shared-token gate, not real authentication.
// Before any public launch, replace with proper admin auth (e.g. NextAuth
// with an allowlisted admin account) - a query-string token is only
// acceptable for internal/dev use.
export default async function AdminTakedownsPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return (
      <div>
        <h1>Unauthorized</h1>
        <p style={{ color: "#666" }}>
          This page requires an admin token (<code>?token=...</code>). Set{" "}
          <code>ADMIN_TOKEN</code> in the environment to enable admin access.
        </p>
      </div>
    );
  }

  const requests = await prisma.takedownRequest.findMany({
    where: { status: "pending" },
    orderBy: { submittedAt: "asc" },
    include: { recipe: true, brewer: true },
  });

  return (
    <div>
      <h1>Pending Takedown Requests ({requests.length})</h1>
      {requests.length === 0 && <p style={{ color: "#666" }}>Nothing pending.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {requests.map((r) => (
          <li key={r.id} style={{ padding: "1rem 0", borderBottom: "1px solid #eee" }}>
            <div>
              <strong>{r.requesterName}</strong> ({r.requesterEmail})
            </div>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>
              Target: {r.recipe ? `recipe "${r.recipe.title ?? r.recipe.slug}"` : "unspecified"}
            </div>
            <p style={{ whiteSpace: "pre-wrap" }}>{r.requestReason}</p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <form
                action={async () => {
                  "use server";
                  await approveTakedown(r.id);
                }}
              >
                <button type="submit" style={approveBtnStyle}>
                  Approve &amp; hide
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await rejectTakedown(r.id);
                }}
              >
                <button type="submit" style={rejectBtnStyle}>
                  Reject
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const approveBtnStyle: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  background: "#c00",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

const rejectBtnStyle: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  background: "#fff",
  color: "#333",
  border: "1px solid #ccc",
  borderRadius: 4,
  cursor: "pointer",
};
