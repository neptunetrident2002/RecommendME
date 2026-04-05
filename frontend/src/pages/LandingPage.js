import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { BookOpen, Headphones, Tv, ArrowRight, Sparkles } from "lucide-react";

const CATEGORIES = [
  { key: "read", label: "Read", icon: BookOpen, color: "bg-[#FF9600]", shadow: "shadow-[0_6px_0_#CC7A00]", img: "https://images.unsplash.com/photo-1714146682506-d6f86fe8517a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHw0fHwzZCUyMGlsbHVzdHJhdGlvbiUyMG9yYW5nZSUyMGJvb2t8ZW58MHx8fHwxNzc0OTUyNTE2fDA&ixlib=rb-4.1.0&q=85&w=300" },
  { key: "listen", label: "Listen", icon: Headphones, color: "bg-[#FF4B4B]", shadow: "shadow-[0_6px_0_#CC3C3C]", img: "https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHwyfHwzZCUyMGlsbHVzdHJhdGlvbiUyMGhlYWRwaG9uZXN8ZW58MHx8fHwxNzc0OTUyNTI5fDA&ixlib=rb-4.1.0&q=85&w=300" },
  { key: "watch", label: "Watch", icon: Tv, color: "bg-[#FFC800]", shadow: "shadow-[0_6px_0_#CCA000]", img: "https://images.pexels.com/photos/7991378/pexels-photo-7991378.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=300&w=300" },
];

export default function LandingPage() {
  const { user, loading } = useAuth();

  if (!loading && user) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-brand-primary text-sm font-bold mb-8 animate-fade-in" data-testid="landing-badge">
            <Sparkles size={16} /> A taste exchange between strangers
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-semibold text-gray-900 tracking-tight leading-tight mb-6" data-testid="landing-headline">
            What do you need<br />today?
          </h1>
          <p className="text-base md:text-lg text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed font-body">
            One stranger. One category. One recommendation each.<br className="hidden sm:block" />
            You receive only after you give.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/register" data-testid="landing-cta-signup" className="px-8 py-4 rounded-2xl text-lg font-bold bg-brand-primary text-white border-2 border-brand-primary border-b-[5px] border-b-[#1899D6] hover:brightness-110 active:translate-y-[3px] active:border-b-2 transition-all flex items-center gap-2">
              Get your first recommendation <ArrowRight size={20} />
            </Link>
            <Link to="/login" data-testid="landing-cta-login" className="px-8 py-4 rounded-2xl text-lg font-bold text-gray-600 border-2 border-gray-200 border-b-[5px] border-b-gray-300 hover:bg-gray-50 active:translate-y-[3px] active:border-b-2 transition-all">
              I already have an account
            </Link>
          </div>
        </div>
        {/* Decorative blobs */}
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-[#FF9600]/10 blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-brand-primary/10 blur-3xl" />
      </section>

      {/* How it works */}
      <section className="px-6 py-16 bg-[#F8F9FA]">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-12" data-testid="landing-how-it-works">
            The simplest exchange
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Choose a category", desc: "Read, Listen, or Watch. Pick what you need today." },
              { step: "2", title: "Give a recommendation", desc: "Share something that changed you. Write why it matters." },
              { step: "3", title: "Receive one back", desc: "A stranger picked one thing for you. Discover it." },
            ].map((item) => (
              <div key={item.step} className="bg-white border-2 border-gray-200 rounded-3xl p-8 shadow-[0_8px_0_#e5e7eb] hover:-translate-y-1 hover:shadow-[0_12px_0_#e5e7eb] transition-all" data-testid={`landing-step-${item.step}`}>
                <div className="w-12 h-12 rounded-2xl bg-brand-primary text-white flex items-center justify-center text-xl font-heading font-bold mb-4 shadow-[0_4px_0_#1899D6]">
                  {item.step}
                </div>
                <h3 className="font-heading text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed font-body">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories preview */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-gray-900 mb-12" data-testid="landing-categories-title">
            Three categories. That's all.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CATEGORIES.map((cat) => (
              <div key={cat.key} className="bg-white border-2 border-gray-200 rounded-3xl p-6 shadow-[0_8px_0_#e5e7eb] hover:-translate-y-1 hover:shadow-[0_12px_0_#e5e7eb] transition-all" data-testid={`landing-category-${cat.key}`}>
                <div className="w-full h-40 rounded-2xl overflow-hidden mb-4">
                  <img src={cat.img} alt={cat.label} className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${cat.color} flex items-center justify-center ${cat.shadow}`}>
                    <cat.icon className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <span className="font-heading text-xl font-semibold text-gray-900">{cat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-gray-100 px-6 py-8" data-testid="landing-footer">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading font-semibold text-gray-900">RecommendME</span>
          </div>
          <p className="text-sm text-gray-400 font-body">A human-filtered taste exchange.</p>
        </div>
      </footer>
    </div>
  );
}
