// components/attractions/PhotoCredit.tsx
// Renders "📸 Photo by @username" with a link
// Place this below each photo in the gallery

type Photo = {
  url:          string;
  alt:          string;
  credit_name?: string;
  credit_url?:  string;
  credit_type?: "instagram" | "facebook" | "other";
};

export function PhotoCredit({ photo }: { photo: Photo }) {
  if (!photo.credit_name) return null;

  const icon = photo.credit_type === "instagram" ? "📸"
             : photo.credit_type === "facebook"  ? "👤"
             : "📷";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      fontSize: 11, color: "#6B7280", marginTop: 4,
    }}>
      <span>{icon} Photo by</span>
      {photo.credit_url ? (
        <a
          href={photo.credit_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#0c7b93", fontWeight: 600, textDecoration: "none" }}
          className="hover:underline"
        >
          {photo.credit_name}
        </a>
      ) : (
        <span style={{ fontWeight: 600 }}>{photo.credit_name}</span>
      )}
    </div>
  );
}
