import { useRef, useState, useCallback } from "react";
import { Download, Share2 } from "lucide-react";
import API from "@/lib/api";

const CARD_VARIANTS = {
  single_rec: "single_rec",
  blend_story: "blend_story",
  taste_stats: "taste_stats",
};

// Map variant to link_type for tracking
const VARIANT_TO_LINK_TYPE = {
  single_rec: "rec_card",
  blend_story: "blend_card",
  taste_stats: "stats_card",
};

const COLORS = {
  read: "#FF9600",
  listen: "#FF4B4B",
  watch: "#FFC800",
};

function SingleRecCard({ data }) {
  const color = COLORS[data.category] || "#1CB0F6";
  return (
    <div
      style={{
        width: "400px", height: "520px", background: "#FFFDF7",
        border: "2px solid #1a1a1a", borderRadius: "16px", padding: "32px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        fontFamily: "'Nunito', sans-serif", position: "relative", overflow: "hidden",
      }}
    >
      <div>
        <div style={{
          display: "inline-block", padding: "6px 16px", borderRadius: "20px",
          background: color, color: color === "#FFC800" ? "#1a1a1a" : "#fff",
          fontSize: "13px", fontWeight: "700", border: "2px solid #1a1a1a",
          marginBottom: "20px", textTransform: "capitalize",
        }}>
          {data.category}
        </div>
        <h2 style={{
          fontFamily: "'Fredoka', sans-serif", fontSize: "24px", fontWeight: "600",
          color: "#1a1a1a", margin: "0 0 8px", lineHeight: "1.2",
        }}>
          {data.title}
        </h2>
        {data.author && (
          <p style={{ fontSize: "15px", color: "#6b6b6b", margin: "0 0 16px" }}>
            by {data.author}
          </p>
        )}
        <div style={{
          background: "#fff", border: "2px solid #1a1a1a", borderRadius: "12px",
          padding: "16px", boxShadow: "4px 4px 0 #1a1a1a",
        }}>
          <p style={{
            fontSize: "14px", color: "#333", lineHeight: "1.6", margin: 0,
            fontStyle: "italic",
          }}>
            "{data.why_note}"
          </p>
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "2px solid #1a1a1a", paddingTop: "16px", marginTop: "20px",
      }}>
        <span style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: "600", fontSize: "16px", color: "#1a1a1a" }}>
          RecommendME
        </span>
        <span style={{ fontSize: "12px", color: "#6b6b6b" }}>recommendme.app</span>
      </div>
    </div>
  );
}

function BlendStoryCard({ data }) {
  return (
    <div
      style={{
        width: "400px", height: "520px", background: "#FFFDF7",
        border: "2px solid #1a1a1a", borderRadius: "16px", padding: "32px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <div>
        <div style={{
          display: "inline-block", padding: "6px 16px", borderRadius: "20px",
          background: "#1CB0F6", color: "#fff", fontSize: "13px", fontWeight: "700",
          border: "2px solid #1a1a1a", marginBottom: "20px",
        }}>
          Blend
        </div>
        <h2 style={{
          fontFamily: "'Fredoka', sans-serif", fontSize: "22px", fontWeight: "600",
          color: "#1a1a1a", margin: "0 0 4px",
        }}>
          {data.user_a_name} + {data.user_b_name}
        </h2>
        {data.score != null && (
          <div style={{
            fontSize: "48px", fontFamily: "'Fredoka', sans-serif", fontWeight: "700",
            color: data.score >= 70 ? "#58CC02" : data.score >= 40 ? "#FF9600" : "#FF4B4B",
            margin: "12px 0",
          }}>
            {data.score}%
          </div>
        )}
        {data.descriptors?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
            {data.descriptors.map((d, i) => (
              <span key={i} style={{
                padding: "4px 12px", borderRadius: "16px", background: "#fff",
                border: "2px solid #1a1a1a", fontSize: "13px", fontWeight: "600",
                color: "#1a1a1a",
              }}>
                {d}
              </span>
            ))}
          </div>
        )}
        {data.score_summary && (
          <p style={{ fontSize: "15px", color: "#333", lineHeight: "1.5", fontStyle: "italic" }}>
            "{data.score_summary}"
          </p>
        )}
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "2px solid #1a1a1a", paddingTop: "16px",
      }}>
        <span style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: "600", fontSize: "16px", color: "#1a1a1a" }}>
          RecommendME
        </span>
        <span style={{ fontSize: "12px", color: "#6b6b6b" }}>recommendme.app</span>
      </div>
    </div>
  );
}

function TasteStatsCard({ data }) {
  return (
    <div
      style={{
        width: "400px", height: "520px", background: "#FFFDF7",
        border: "2px solid #1a1a1a", borderRadius: "16px", padding: "32px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <div>
        <h2 style={{
          fontFamily: "'Fredoka', sans-serif", fontSize: "22px", fontWeight: "600",
          color: "#1a1a1a", margin: "0 0 4px",
        }}>
          {data.display_name || "My"} taste
        </h2>
        <p style={{ fontSize: "14px", color: "#6b6b6b", margin: "0 0 24px" }}>on RecommendME</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {["read", "listen", "watch"].map((cat) => {
            const count = data.categories?.[cat] || 0;
            const maxCount = Math.max(...Object.values(data.categories || { read: 1 }), 1);
            const pct = Math.round((count / maxCount) * 100);
            return (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{
                  width: "60px", fontSize: "13px", fontWeight: "700",
                  textTransform: "capitalize", color: "#1a1a1a",
                }}>
                  {cat}
                </span>
                <div style={{
                  flex: 1, height: "28px", background: "#fff",
                  border: "2px solid #1a1a1a", borderRadius: "8px", overflow: "hidden",
                }}>
                  <div style={{
                    width: `${Math.max(pct, 8)}%`, height: "100%",
                    background: COLORS[cat], borderRadius: "6px",
                  }} />
                </div>
                <span style={{ width: "30px", fontSize: "14px", fontWeight: "700", textAlign: "right" }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{
          marginTop: "24px", background: "#fff", border: "2px solid #1a1a1a",
          borderRadius: "12px", padding: "16px", boxShadow: "4px 4px 0 #1a1a1a",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#6b6b6b" }}>Total items</span>
            <span style={{ fontSize: "15px", fontWeight: "700" }}>{data.total || 0}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", color: "#6b6b6b" }}>Completed</span>
            <span style={{ fontSize: "15px", fontWeight: "700", color: "#58CC02" }}>{data.completed || 0}</span>
          </div>
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "2px solid #1a1a1a", paddingTop: "16px",
      }}>
        <span style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: "600", fontSize: "16px", color: "#1a1a1a" }}>
          RecommendME
        </span>
        <span style={{ fontSize: "12px", color: "#6b6b6b" }}>recommendme.app</span>
      </div>
    </div>
  );
}

export default function ShareCard({ variant = "single_rec", data = {} }) {
  const cardRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const trackGeneration = useCallback(async () => {
    try {
      const linkType = VARIANT_TO_LINK_TYPE[variant] || "rec_card";
      await API.post("/link-events", { link_type: linkType, event_type: "click" });
    } catch {
      // Silently fail tracking - don't block the user
    }
  }, [variant]);

  const generateImage = useCallback(async () => {
    if (!cardRef.current || generating) return;
    setGenerating(true);
    try {
      // Track the card generation
      trackGeneration();
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, backgroundColor: "#FFFDF7", useCORS: true,
        logging: false, width: 400, height: 520,
      });
      const link = document.createElement("a");
      link.download = `recommendme-${variant}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Share card generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }, [variant, generating, trackGeneration]);

  const shareImage = useCallback(async () => {
    if (!cardRef.current || generating) return;
    setGenerating(true);
    try {
      // Track the card generation
      trackGeneration();
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, backgroundColor: "#FFFDF7", useCORS: true,
        logging: false, width: 400, height: 520,
      });
      canvas.toBlob(async (blob) => {
        if (navigator.share && blob) {
          try {
            await navigator.share({
              files: [new File([blob], `recommendme-${variant}.png`, { type: "image/png" })],
              title: "RecommendME",
            });
          } catch { /* user cancelled */ }
        } else {
          const link = document.createElement("a");
          link.download = `recommendme-${variant}.png`;
          link.href = canvas.toDataURL("image/png");
          link.click();
        }
        setGenerating(false);
      }, "image/png");
    } catch {
      setGenerating(false);
    }
  }, [variant, generating]);

  const CardComponent = variant === CARD_VARIANTS.blend_story ? BlendStoryCard
    : variant === CARD_VARIANTS.taste_stats ? TasteStatsCard
    : SingleRecCard;

  return (
    <div data-testid={`share-card-${variant}`}>
      {/* Hidden render target for html2canvas — uses INLINE styles only */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} ref={cardRef}>
        <CardComponent data={data} />
      </div>

      {/* Preview (visible) */}
      <div className="mx-auto max-w-[400px]" style={{ transform: "scale(0.85)", transformOrigin: "top center" }}>
        <CardComponent data={data} />
      </div>

      <div className="flex gap-3 justify-center mt-4">
        <button
          onClick={generateImage}
          disabled={generating}
          data-testid="share-card-download-btn"
          className="bold-btn bold-btn-primary px-5 py-2.5 text-sm flex items-center gap-2"
        >
          <Download size={16} /> {generating ? "Generating..." : "Download"}
        </button>
        <button
          onClick={shareImage}
          disabled={generating}
          data-testid="share-card-share-btn"
          className="bold-btn bold-btn-ghost px-5 py-2.5 text-sm flex items-center gap-2"
        >
          <Share2 size={16} /> Share
        </button>
      </div>
    </div>
  );
}

export { CARD_VARIANTS };
