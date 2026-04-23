import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import API from "@/lib/api";
import { Settings, LogOut, Shield, Share2, Copy, Link2, Plus, Trash2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ProfilePage() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [city, setCity] = useState(user?.city || "");
  const [handle, setHandle] = useState(user?.public_handle || "");
  const [isPublic, setIsPublic] = useState(user?.is_public || false);
  const [socialHandle, setSocialHandle] = useState(user?.social_handle || "");
  const [socialPlatform, setSocialPlatform] = useState(user?.social_platform || "instagram");
  const [saving, setSaving] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [recExLink, setRecExLink] = useState(null);
  const [knownInvites, setKnownInvites] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [showBlocks, setShowBlocks] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [slRes, relRes, kiRes, blRes] = await Promise.all([
        API.post("/shareable-link/generate").catch(() => ({ data: null })),
        API.get("/rec-exchange-link/mine").catch(() => ({ data: { link: null } })),
        API.get("/known-blend/invites").catch(() => ({ data: [] })),
        API.get("/blocks").catch(() => ({ data: [] })),
      ]);
      setShareLink(slRes.data);
      setRecExLink(relRes.data?.link || null);
      setKnownInvites(kiRes.data || []);
      setBlocks(blRes.data || []);
    } catch (err) {
      console.error("Failed to load profile data:", err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName, city, public_handle: handle, is_public: isPublic, social_handle: socialHandle, social_platform: socialPlatform });
      toast.success("Profile updated!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setSaving(false); }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const copyLink = (path) => {
    navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast.success("Link copied!");
  };

  const handleCreateKnownInvite = async () => {
    try {
      const { data } = await API.post("/known-blend/invite");
      toast.success("Invite created!");
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleUnblock = async (blockId) => {
    try { await API.delete(`/blocks/${blockId}`); toast.success("Unblocked"); loadData(); } catch {}
  };

  const handleCreateRecExLink = async () => {
    const recs = await API.get("/recommendations/mine");
    if (recs.data.length === 0) { toast.error("Create a recommendation first"); return; }
    try {
      const { data } = await API.post("/rec-exchange-link/create", { recommendation_id: recs.data[0].id });
      setRecExLink(data);
      toast.success("Rec exchange link created!");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-6 py-8 pb-safe" data-testid="profile-page">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#1a1a1a] tracking-tight mb-6" data-testid="profile-title">Profile</h1>

        {/* Profile fields */}
        <div className="bold-card p-6 mb-6">
          <h2 className="font-heading text-lg font-semibold text-[#1a1a1a] mb-4">Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-1">Display name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bold-input" data-testid="profile-name" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-1">City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="bold-input" data-testid="profile-city" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-1">Public handle <span className="text-[#b0b0b0]">(for /u/ page)</span></label>
              <input value={handle} onChange={(e) => setHandle(e.target.value)} className="bold-input" placeholder="your-handle" data-testid="profile-handle" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsPublic(!isPublic)} data-testid="profile-public-toggle"
                className={`bold-btn px-4 py-2 text-sm ${isPublic ? "bold-btn-green" : "bold-btn-ghost"}`}>
                {isPublic ? "Public profile on" : "Public profile off"}
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-1">Social handle</label>
              <div className="flex gap-2">
                <select value={socialPlatform} onChange={(e) => setSocialPlatform(e.target.value)}
                  className="bold-input w-auto" data-testid="profile-social-platform">
                  <option value="instagram">Instagram</option>
                  <option value="snapchat">Snapchat</option>
                  <option value="x">X</option>
                </select>
                <input value={socialHandle} onChange={(e) => setSocialHandle(e.target.value)} className="bold-input flex-1" placeholder="@yourhandle" data-testid="profile-social-handle" />
              </div>
              <p className="text-[10px] text-[#b0b0b0] mt-1">Revealed to connections after 7 mutual exchanges</p>
            </div>
            <button onClick={handleSave} disabled={saving} data-testid="profile-save-btn"
              className="bold-btn bold-btn-primary px-6 py-2.5 text-sm">{saving ? "Saving..." : "Save changes"}</button>
          </div>
        </div>

        {/* Links */}
        <div className="bold-card p-6 mb-6">
          <h2 className="font-heading text-lg font-semibold text-[#1a1a1a] mb-4">Your links</h2>
          <div className="space-y-3">
            {/* Shareable link (Type 1) */}
            {shareLink && (
              <div className="flex items-center justify-between bg-[#FFFDF7] border-2 border-[#1a1a1a] rounded-xl p-3">
                <div>
                  <p className="text-xs font-bold text-[#6b6b6b]">Shareable link (Type 1)</p>
                  <p className="text-xs text-[#b0b0b0] font-mono">/r/{shareLink.token}</p>
                </div>
                <button onClick={() => copyLink(`/r/${shareLink.token}`)} className="bold-btn bold-btn-ghost px-3 py-1.5 text-xs" data-testid="copy-share-link">
                  <Copy size={14} />
                </button>
              </div>
            )}
            {/* Rec exchange link (Type 2) */}
            <div className="flex items-center justify-between bg-[#FFFDF7] border-2 border-[#1a1a1a] rounded-xl p-3">
              <div>
                <p className="text-xs font-bold text-[#6b6b6b]">Rec exchange link (Type 2)</p>
                {recExLink ? (
                  <p className="text-xs text-[#b0b0b0] font-mono">/x/{recExLink.token} · expires {new Date(recExLink.expires_at).toLocaleDateString()}</p>
                ) : (
                  <p className="text-xs text-[#b0b0b0]">Not created</p>
                )}
              </div>
              {recExLink ? (
                <button onClick={() => copyLink(`/x/${recExLink.token}`)} className="bold-btn bold-btn-ghost px-3 py-1.5 text-xs" data-testid="copy-rec-exchange-link">
                  <Copy size={14} />
                </button>
              ) : (
                <button onClick={handleCreateRecExLink} className="bold-btn bold-btn-primary px-3 py-1.5 text-xs" data-testid="create-rec-exchange-link">
                  <Plus size={14} />
                </button>
              )}
            </div>
            {/* Public page */}
            {handle && isPublic && (
              <div className="flex items-center justify-between bg-[#FFFDF7] border-2 border-[#1a1a1a] rounded-xl p-3">
                <div>
                  <p className="text-xs font-bold text-[#6b6b6b]">Public taste page</p>
                  <p className="text-xs text-[#b0b0b0] font-mono">/u/{handle}</p>
                </div>
                <button onClick={() => copyLink(`/u/${handle}`)} className="bold-btn bold-btn-ghost px-3 py-1.5 text-xs"><Copy size={14} /></button>
              </div>
            )}
          </div>
        </div>

        {/* Known blend invites */}
        <div className="bold-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold text-[#1a1a1a]">Known blend invites</h2>
            <span className="text-xs font-bold text-[#6b6b6b]">{user?.known_blend_invites_sent || 0}/2 used</span>
          </div>
          <p className="text-xs text-[#6b6b6b] mb-3">Send an invite link to someone you know to see your taste blend.</p>
          <button onClick={handleCreateKnownInvite} disabled={(user?.known_blend_invites_sent || 0) >= 2}
            className="bold-btn bold-btn-ghost px-4 py-2 text-sm mb-4" data-testid="create-known-invite-btn">
            <Plus size={14} className="inline mr-1" /> Create invite
          </button>
          {knownInvites.length > 0 && (
            <div className="space-y-2">
              {knownInvites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between bg-[#FFFDF7] border-2 border-[#1a1a1a] rounded-xl p-3">
                  <div>
                    <span className={`bold-badge text-[10px] ${inv.status === "accepted" ? "bg-[#58CC02] text-white" : inv.status === "expired" ? "bg-[#f5f5f5] text-[#b0b0b0]" : "bg-[#FFC800] text-[#1a1a1a]"}`}>
                      {inv.status}
                    </span>
                    {inv.accepted_user && <span className="text-xs text-[#6b6b6b] ml-2">{inv.accepted_user.display_name}</span>}
                  </div>
                  {inv.status === "pending" && (
                    <button onClick={() => copyLink(`/blend-invite/${inv.token}`)} className="bold-btn bold-btn-ghost px-3 py-1.5 text-xs"><Copy size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blocks */}
        <div className="bold-card p-6 mb-6">
          <button onClick={() => setShowBlocks(!showBlocks)} className="flex items-center justify-between w-full">
            <h2 className="font-heading text-lg font-semibold text-[#1a1a1a]">Blocked users</h2>
            <span className="text-xs font-bold text-[#b0b0b0]">{blocks.length}</span>
          </button>
          {showBlocks && blocks.length > 0 && (
            <div className="space-y-2 mt-3">
              {blocks.map((b) => (
                <div key={b.id} className="flex items-center justify-between bg-[#FFFDF7] border-2 border-[#1a1a1a] rounded-xl p-3">
                  <span className="text-sm text-[#1a1a1a]">{b.blocked_user?.display_name || "User"}</span>
                  <button onClick={() => handleUnblock(b.id)} className="bold-btn bold-btn-ghost px-3 py-1.5 text-xs text-[#FF4B4B]">Unblock</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout */}
        <button onClick={handleLogout} data-testid="profile-logout-btn"
          className="bold-btn bold-btn-ghost w-full py-3 text-sm text-[#FF4B4B] flex items-center justify-center gap-2">
          <LogOut size={16} /> Log out
        </button>
      </div>
    </div>
  );
}
