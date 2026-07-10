import { submitTakedownRequest } from "./actions";

interface Props {
  searchParams: Promise<{ recipe?: string }>;
}

export default async function TakedownPage({ searchParams }: Props) {
  const { recipe } = await searchParams;

  return (
    <div>
      <h1>Request Removal</h1>
      <p style={{ color: "#666" }}>
        If you&apos;re the original author of a recipe (or brewed under a username shown here)
        and would like it removed from this archive, submit a request below. We&apos;ll review
        it and remove the recipe from public view - the goal is to make this easy, not to argue
        about it.
      </p>
      <form action={submitTakedownRequest} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 480 }}>
        <label>
          Recipe URL slug (optional - leave blank to request removal of everything under your
          username)
          <input name="recipeSlug" defaultValue={recipe} style={inputStyle} />
        </label>
        <label>
          Your name
          <input name="requesterName" required style={inputStyle} />
        </label>
        <label>
          Your email
          <input name="requesterEmail" type="email" required style={inputStyle} />
        </label>
        <label>
          Reason / details (e.g. your original BrewToad username, which recipes)
          <textarea name="requestReason" required rows={4} style={inputStyle} />
        </label>
        <button type="submit" style={submitBtnStyle}>
          Submit request
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.5rem",
  marginTop: "0.25rem",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontFamily: "inherit",
};

const submitBtnStyle: React.CSSProperties = {
  padding: "0.6rem 1.2rem",
  background: "#3a2a1a",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  width: "fit-content",
};
