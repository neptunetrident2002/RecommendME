import { useState, useEffect } from "react";
import API from "@/lib/api";
import { Search, Archive, MessageSquare, Check, Clock, ExternalLink, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ShareCard, { CARD_VARIANTS } from "@/components/ShareCard";

const CAT_COLOR = { read: "#FF9600", listen: "#FF4B4B", watch: "#FFC800" };
const STATUS_LABEL = { not_started: "Not started", in_progress: "In progress", completed: "Completed" };
const SOURCE_LABEL = { match: "Stranger match", broadcast: "Broadcast", link: "Shareable link", llm: "Curated by RecommendME", rec_exchange: "Rec exchange", self: "Added by you" };

export default function MyList() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [tab, setTab] = useState("my_list");
  
  const [editEntry, setEditEntry] = useState(null);
  const [editComment, setEditComment] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [shareEntry, setShareEntry] = useState(null);
  
  // Add new item state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newCategory, setNewCategory] = useState("read");
  const [newWhyNote, setNewWhyNote] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadList(); loadStats(); }, [catFilter, search, tab, showArchived]);

  const loadList = async () => {
    try {
      const params = new URLSearchParams();
      if (catFilter) params.set("category", catFilter);
      if (search) params.set("search", search);
      params.set("tab", tab);
      if (showArchived) params.set("show_archived", "true");
      const { data } = await API.get(`/list?${params}`);
      setEntries(data);
    } catch {} finally { setLoading(false); }
  };

  const loadStats = async () => {
    try { const { data } = await API.get("/list/stats"); setStats(data); } catch {}
  };

  const handleUpdate = async () => {
    if (!editEntry) return;
    try {
      await API.put(`/list/${editEntry.id}`, { completion_status: editStatus, user_comment: editComment });
      toast.success("Updated!");
      setEditEntry(null);
      loadList(); loadStats();
    } catch { toast.error("Could not update"); }
  };

  const handleArchive = async (id) => {
    try { await API.put(`/list/${id}`, { is_archived: true }); toast.success("Archived"); loadList(); } catch {}
  };

  const handleDelete = async (id) => {
    try { await API.delete(`/list/${id}`); toast.success("Removed"); loadList(); loadStats(); } catch {}
  };

  const handleAddToList = async () => {
    if (!newTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    setAdding(true);
    try {
      await API.post("/list/add", {
        title: newTitle.trim(),
        author: newAuthor.trim(),
        category: newCategory,
        why_note: newWhyNote.trim(),
      });
      toast.success("Added to your list!");
      setShowAddDialog(false);
      setNewTitle("");
      setNewAuthor("");
      setNewCategory("read");
      setNewWhyNote("");
      loadList();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not add");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-6 py-8 pb-safe" data-testid="my-list-page">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#1a1a1a] tracking-tight" data-testid="my-list-title">My list</h1>
          <button onClick={() => setShowArchived(!showArchived)} className={`bold-btn px-3 py-1.5 text-xs ${showArchived ? "bold-btn-primary" : "bold-btn-ghost"}`}>
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>
        <p className="text-[#6b6b6b] font-body mb-6 text-sm">Everything recommended to you, always yours.</p>
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-6" data-testid="list-stats">
            <div className="bold-card p-3 text-center"><p className="text-xs font-bold text-[#6b6b6b]">Total</p><p className="font-heading text-xl font-bold text-[#1CB0F6]">{stats.total}</p></div>
            <div className="bold-card p-3 text-center"><p className="text-xs font-bold text-[#6b6b6b]">Read</p><p className="font-heading text-xl font-bold text-[#FF9600]">{stats.categories?.read || 0}</p></div>
            <div className="bold-card p-3 text-center"><p className="text-xs font-bold text-[#6b6b6b]">Listen</p><p className="font-heading text-xl font-bold text-[#FF4B4B]">{stats.categories?.listen || 0}</p></div>
            <div className="bold-card p-3 text-center"><p className="text-xs font-bold text-[#6b6b6b]">Watch</p><p className="font-heading text-xl font-bold text-[#FFC800]">{stats.categories?.watch || 0}</p></div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList className="bg-white border-2 border-[#1a1a1a] rounded-xl p-1 h-auto w-full">
            <TabsTrigger value="matched_list" className="rounded-lg font-bold flex-1 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" data-testid="tab-matched">Received</TabsTrigger>
            <TabsTrigger value="my_list" className="rounded-lg font-bold flex-1 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" data-testid="tab-my">My additions</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Add button for My additions tab */}
        {tab === "my_list" && (
          <button
            onClick={() => setShowAddDialog(true)}
            className="bold-btn bold-btn-primary w-full py-3 mb-6 flex items-center justify-center gap-2"
            data-testid="add-to-list-btn"
          >
            <Plus size={18} /> Add to my list
          </button>
        )}

        {/* Search + filters */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b0b0b0]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
              className="bold-input pl-10 py-2.5 text-sm" data-testid="list-search-input" />
          </div>
          <div className="flex gap-2">
            {["", "read", "listen", "watch"].map((c) => (
              <button key={c} onClick={() => setCatFilter(c)} data-testid={`filter-${c || "all"}`}
                className={`bold-btn px-3 py-2 text-xs ${catFilter === c ? "bold-btn-primary" : "bold-btn-ghost"}`}>
                {c || "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Entries */}
        {loading ? (
          <p className="text-center py-16 text-[#b0b0b0]">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="bold-card p-10 text-center" data-testid="list-empty">
            <h3 className="font-heading text-lg font-semibold text-[#1a1a1a] mb-2">Nothing here yet</h3>
            <p className="text-[#6b6b6b] text-sm font-body">
              {tab === "my_list" 
                ? "Add your own recommendations to keep track of what you want to explore." 
                : "Match with someone to receive a recommendation."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const rec = entry.recommendation;
              if (!rec) return null;
              const color = CAT_COLOR[rec.category] || "#1CB0F6";
              return (
                <div key={entry.id} className="bold-card p-4" data-testid={`list-entry-${entry.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bold-badge text-[10px]" style={{ background: color, color: color === "#FFC800" ? "#1a1a1a" : "#fff" }}>{rec.category}</span>
                        {rec.genre && <span className="bold-badge bg-[#FFFDF7] text-[10px]">{rec.genre}</span>}
                        <span className="text-[10px] text-[#b0b0b0]">{SOURCE_LABEL[entry.source_type] || ""}</span>
                      </div>
                      <h3 className="font-heading font-semibold text-[#1a1a1a] text-sm">{rec.title}</h3>
                      {rec.author && <p className="text-xs text-[#6b6b6b]">{rec.author}</p>}
                      <p className="text-xs text-[#6b6b6b] mt-1 italic line-clamp-2">"{rec.why_note}"</p>
                      {entry.user_comment && (
                        <p className="mt-1.5 text-[10px] text-[#6b6b6b] bold-card !p-2 !shadow-none">
                          <MessageSquare size={10} className="inline mr-1" />{entry.user_comment}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={entry.completion_status} />
                      <div className="flex gap-1">
  <button onClick={() => { setEditEntry(entry); setEditComment(entry.user_comment || ""); setEditStatus(entry.completion_status || "not_started"); }}
    className="text-[10px] font-bold text-[#6b6b6b] hover:text-[#1a1a1a]" data-testid={`edit-entry-${entry.id}`}>Edit</button>
  <button onClick={() => setShareEntry(rec)} className="text-[10px] font-bold text-[#1CB0F6] hover:text-[#1a1a1a]">Share</button>
  {entry.is_archived ? (
    <button onClick={async () => { try { await API.put(`/list/${entry.id}`, { is_archived: false }); toast.success("Unarchived"); loadList(); } catch {} }} className="text-[10px] text-[#58CC02] hover:text-[#1a1a1a]">Restore</button>
  ) : (
    <button onClick={() => handleArchive(entry.id)} className="text-[10px] text-[#b0b0b0] hover:text-[#1a1a1a]"><Archive size={12} /></button>
  )}
  <button
    onClick={() => { if (window.confirm("Remove this from your list?")) handleDelete(entry.id); }}
    className="text-[10px] text-[#FF4B4B] hover:text-[#1a1a1a]"
    data-testid={`delete-entry-${entry.id}`}
  ><Trash2 size={12} /></button>
</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(open) => { if (!open) setEditEntry(null); }}>
        <DialogContent className="sm:max-w-md bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
          <DialogHeader><DialogTitle className="font-heading text-xl font-semibold text-[#1a1a1a]">Update entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-2">Status</label>
              <div className="flex gap-2">
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <button key={k} onClick={() => setEditStatus(k)} data-testid={`edit-status-${k}`}
                    className={`bold-btn px-3 py-2 text-sm ${editStatus === k ? "bold-btn-primary" : "bold-btn-ghost"}`}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-2">Your note</label>
              <textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} rows={3}
                className="bold-input resize-none" placeholder="Your thoughts..." data-testid="edit-comment-input" />
            </div>
            <button onClick={handleUpdate} data-testid="edit-save-btn" className="w-full bold-btn bold-btn-primary py-3 text-base">Save</button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!shareEntry} onOpenChange={(open) => { if (!open) setShareEntry(null); }}>
  <DialogContent className="sm:max-w-md bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
    <DialogHeader><DialogTitle className="font-heading text-xl font-semibold text-[#1a1a1a]">Share this rec</DialogTitle></DialogHeader>
    {shareEntry && <ShareCard variant={CARD_VARIANTS.single_rec} data={shareEntry} />}
  </DialogContent>
  </Dialog>

      {/* Add to List Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
          <DialogHeader><DialogTitle className="font-heading text-xl font-semibold text-[#1a1a1a]">Add to your list</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-2">Category</label>
              <div className="flex gap-2">
                {["read", "listen", "watch"].map((c) => (
                  <button key={c} onClick={() => setNewCategory(c)} data-testid={`add-category-${c}`}
                    className={`bold-btn px-4 py-2 text-sm capitalize ${newCategory === c ? "bold-btn-primary" : "bold-btn-ghost"}`}
                    style={newCategory === c ? { background: CAT_COLOR[c], color: c === "watch" ? "#1a1a1a" : "#fff" } : {}}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-2">Title *</label>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                className="bold-input" placeholder="What do you want to explore?" data-testid="add-title-input" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-2">Author / Creator</label>
              <input value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)}
                className="bold-input" placeholder="Who made it?" data-testid="add-author-input" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-2">Why this? (optional)</label>
              <textarea value={newWhyNote} onChange={(e) => setNewWhyNote(e.target.value)} rows={2}
                className="bold-input resize-none" placeholder="Why do you want to check this out?" data-testid="add-why-input" />
            </div>
            <button onClick={handleAddToList} disabled={adding} data-testid="add-submit-btn"
              className="w-full bold-btn bold-btn-primary py-3 text-base">
              {adding ? "Adding..." : "Add to list"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    not_started: { icon: Clock, bg: "#f5f5f5", text: "#6b6b6b", label: "Not started" },
    in_progress: { icon: Clock, bg: "#E3F2FD", text: "#1CB0F6", label: "In progress" },
    completed: { icon: Check, bg: "#E8F5E9", text: "#58CC02", label: "Done" },
  };
  const c = config[status] || config.not_started;
  return (
    <span className="bold-badge text-[10px]" style={{ background: c.bg, color: c.text }} data-testid={`status-badge-${status}`}>
      <c.icon size={10} /> {c.label}
    </span>
  );
}
