export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { approveTakedown, rejectTakedown } from "./actions";

export default async function AdminTakedownsPage() {
  if (!(await isAdmin())) {
    return (
      <div>
        <h1>Unauthorized</h1>
        <p style={{ color: "#666" }}>
          This page is for the site administrator.{" "}
          <a href="/admin/login">Sign in</a> to review takedown requests.
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
