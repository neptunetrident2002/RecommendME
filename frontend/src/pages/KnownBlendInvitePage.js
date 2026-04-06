import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function KnownBlendInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    API.get(`/known-blend/invite/${token}`).then(r => setInvite(r.data)).catch(() => toast.error("Invite not found or expired")).finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!user) { navigate(`/register`); return; }
    setAccepting(true);
    try {
      const { data } = await API.post("/known-blend/accept", { token });
      toast.success("Blend created!");
      navigate(`/connections`);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setAccepting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]"><Loader2 className="w-8 h-8 animate-spin text-[#1CB0F6]" /></div>;
  if (!invite) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]"><p className="text-[#6b6b6b]">Invite not found or expired.</p></div>;

  return (
    <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center px-6 py-12" data-testid="known-blend-invite-page">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#1a1a1a] bg-[#E8E0FF] flex items-center justify-center mb-6">
          <Sparkles size={28} className="text-[#7C3AED]" />
        </div>
        <h1 className="font-heading text-2xl font-semibold text-[#1a1a1a] mb-2">
          {invite.inviter_name} invited you to a blend
        </h1>
        <p className="text-[#6b6b6b] font-body text-sm mb-8">
          Accept to see how your tastes compare. You'll both need to build your lists first.
        </p>
        <button onClick={handleAccept} disabled={accepting}
          className="bold-btn bold-btn-primary px-8 py-4 text-base mx-auto" data-testid="accept-invite-btn">
          {accepting ? "Accepting..." : user ? "Accept invite" : "Sign up to accept"}
        </button>
      </div>
    </div>
  );
}
