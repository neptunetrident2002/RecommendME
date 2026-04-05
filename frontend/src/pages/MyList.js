import { useState, useEffect } from "react";
import API from "@/lib/api";
import { BookOpen, Headphones, Tv, Search, Filter, Archive, MessageSquare, Check, Clock, ChevronDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CAT_ICON = { read: BookOpen, listen: Headphones, watch: Tv };
const CAT_COLOR = { read: "#FF9600", listen: "#FF4B4B", watch: "#FFC800" };
const STATUS_LABEL = { not_started: "Not started", in_progress: "In progress", completed: "Completed" };
const SOURCE_LABEL = { match: "Stranger match", connection: "Connection", broadcast: "Broadcast", link: "Via shareable link", llm: "Curated by RecommendME" };

export default function MyList() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [editComment, setEditComment] = useState("");
  const [editStatus, setEditStatus] = useState("");

  useEffect(() => { loadList(); loadStats(); }, [categoryFilter, statusFilter, sourceFilter, showArchived, search]);

  const loadList = async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("completion_status", statusFilter);
      if (sourceFilter) params.set("source_type", sourceFilter);
      if (search) params.set("search", search);
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
      loadList();
      loadStats();
    } catch { toast.error("Could not update"); }
  };

  const handleArchive = async (id) => {
    try {
      await API.put(`/list/${id}`, { is_archived: true });
      toast.success("Archived");
      loadList();
    } catch { toast.error("Could not archive"); }
  };

  const openEdit = (entry) => {
    setEditEntry(entry);
    setEditComment(entry.user_comment || "");
    setEditStatus(entry.completion_status || "not_started");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] px-6 py-8" data-testid="my-list-page">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight mb-2" data-testid="my-list-title">My List</h1>
        <p className="text-gray-500 font-body mb-8">Every recommendation you've received, always yours.</p>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="list-stats">
            <StatCard label="Total" value={stats.total} color="#1CB0F6" />
            <StatCard label="Read" value={stats.categories?.read || 0} color="#FF9600" />
            <StatCard label="Listen" value={stats.categories?.listen || 0} color="#FF4B4B" />
            <StatCard label="Watch" value={stats.categories?.watch || 0} color="#FFC800" />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title..."
              className="w-full bg-white border-2 border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-medium focus:border-brand-primary outline-none"
              data-testid="list-search-input" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger data-testid="list-category-filter" className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-white border-2 border-gray-200 hover:bg-gray-50">
              <Filter size={14} /> {categoryFilter ? categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1) : "Category"} <ChevronDown size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl">
              <DropdownMenuItem onClick={() => setCategoryFilter("")}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter("read")}>Read</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter("listen")}>Listen</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter("watch")}>Watch</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger data-testid="list-status-filter" className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-white border-2 border-gray-200 hover:bg-gray-50">
              {statusFilter ? STATUS_LABEL[statusFilter] : "Status"} <ChevronDown size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl">
              <DropdownMenuItem onClick={() => setStatusFilter("")}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("not_started")}>Not started</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("in_progress")}>In progress</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("completed")}>Completed</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button onClick={() => setShowArchived(!showArchived)} data-testid="list-archive-toggle"
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold border-2 transition-colors ${
              showArchived ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>
            <Archive size={14} /> {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>

        {/* Entries */}
        {loading ? (
          <div className="text-center py-20"><p className="text-gray-400 font-body">Loading...</p></div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 bg-white border-2 border-gray-200 rounded-3xl shadow-[0_8px_0_#e5e7eb]" data-testid="list-empty">
            <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="font-heading text-xl font-semibold text-gray-900 mb-2">Your list is waiting for its first recommendation.</h3>
            <p className="text-gray-500 font-body text-sm">Go match with someone to receive one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => {
              const rec = entry.recommendation;
              if (!rec) return null;
              const Icon = CAT_ICON[rec.category] || BookOpen;
              const color = CAT_COLOR[rec.category] || "#1CB0F6";
              return (
                <div key={entry.id} className="bg-white border-2 border-gray-200 rounded-3xl p-5 shadow-[0_6px_0_#e5e7eb] hover:-translate-y-[1px] hover:shadow-[0_8px_0_#e5e7eb] transition-all" data-testid={`list-entry-${entry.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                          <Icon size={16} style={{ color }} strokeWidth={2.5} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{rec.category}</span>
                        <span className="text-xs text-gray-300 mx-1">&middot;</span>
                        <span className="text-xs text-gray-400">{SOURCE_LABEL[entry.source_type] || entry.source_type}</span>
                      </div>
                      <h3 className="font-heading text-lg font-semibold text-gray-900">{rec.title}</h3>
                      {rec.author && <p className="text-sm text-gray-500 font-body">{rec.author}</p>}
                      <p className="text-sm text-gray-600 font-body mt-2 italic line-clamp-2">"{rec.why_note}"</p>
                      {rec.url && (
                        <a href={rec.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-brand-primary hover:underline">
                          <ExternalLink size={12} /> Link
                        </a>
                      )}
                      {entry.user_comment && (
                        <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                          <MessageSquare size={12} className="inline mr-1" /> {entry.user_comment}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={entry.completion_status} />
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(entry)} className="px-3 py-1 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors" data-testid={`edit-entry-${entry.id}`}>
                          Edit
                        </button>
                        {!entry.is_archived && (
                          <button onClick={() => handleArchive(entry.id)} className="px-3 py-1 rounded-lg text-xs font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" data-testid={`archive-entry-${entry.id}`}>
                            <Archive size={12} />
                          </button>
                        )}
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
        <DialogContent className="sm:max-w-md rounded-3xl border-2 border-gray-200">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-semibold">Update entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Status</label>
              <div className="flex gap-2">
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <button key={k} onClick={() => setEditStatus(k)} data-testid={`edit-status-${k}`}
                    className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                      editStatus === k ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Your comment</label>
              <textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} rows={3}
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-sm focus:border-brand-primary outline-none resize-none"
                placeholder="Your thoughts about this recommendation..." data-testid="edit-comment-input" />
            </div>
            <button onClick={handleUpdate} data-testid="edit-save-btn"
              className="w-full py-3 rounded-2xl font-bold uppercase bg-brand-primary text-white border-2 border-brand-primary border-b-4 border-b-[#1899D6] hover:brightness-110 active:translate-y-[2px] active:border-b-2 transition-all">
              Save changes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-[0_4px_0_#e5e7eb]">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="font-heading text-2xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    not_started: { icon: Clock, bg: "bg-gray-100", text: "text-gray-500", label: "Not started" },
    in_progress: { icon: Clock, bg: "bg-blue-50", text: "text-brand-primary", label: "In progress" },
    completed: { icon: Check, bg: "bg-green-50", text: "text-[#58CC02]", label: "Completed" },
  };
  const c = config[status] || config.not_started;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${c.bg} ${c.text}`} data-testid={`status-badge-${status}`}>
      <c.icon size={12} /> {c.label}
    </span>
  );
}
