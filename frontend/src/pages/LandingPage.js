import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      {/* Hero — typographic only */}
      <section className="px-6 pt-20 pb-24 md:pt-28 md:pb-36">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-semibold text-[#1a1a1a] tracking-tight leading-[1.1] mb-6" data-testid="landing-headline">
            What do you need today?
          </h1>
          <p className="text-base md:text-lg text-[#6b6b6b] max-w-lg mb-10 leading-relaxed font-body">
            One stranger. One category. One recommendation each. You receive only after you give.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/register" data-testid="landing-cta-signup" className="bold-btn bold-btn-primary px-8 py-4 text-lg flex items-center gap-2">
              Get your first recommendation <ArrowRight size={20} />
            </Link>
            <Link to="/login" data-testid="landing-cta-login" className="bold-btn bold-btn-ghost px-8 py-4 text-lg">
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 border-t-2 border-[#1a1a1a]">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-[#1a1a1a] mb-10" data-testid="landing-how-it-works">
            The simplest exchange
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: "1", title: "Choose a category", desc: "Read, Listen, or Watch. Pick what you need today.", color: "#FF9600" },
              { n: "2", title: "Give a recommendation", desc: "Share something that changed you. Write why it matters.", color: "#FF4B4B" },
              { n: "3", title: "Receive one back", desc: "A stranger picked one thing for you. Discover it.", color: "#1CB0F6" },
            ].map((step) => (
              <div key={step.n} className="bold-card p-6" data-testid={`landing-step-${step.n}`}>
                <div className="w-10 h-10 rounded-lg border-2 border-[#1a1a1a] flex items-center justify-center font-heading font-bold text-lg text-white mb-4" style={{ background: step.color }}>
                  {step.n}
                </div>
                <h3 className="font-heading text-lg font-semibold text-[#1a1a1a] mb-2">{step.title}</h3>
                <p className="text-[#6b6b6b] text-sm leading-relaxed font-body">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="px-6 py-16 border-t-2 border-[#1a1a1a]">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-[#1a1a1a] mb-10">
            Three categories. That's all.
          </h2>
          <div className="flex flex-wrap gap-4">
            {[
              { label: "Read", color: "#FF9600" },
              { label: "Listen", color: "#FF4B4B" },
              { label: "Watch", color: "#FFC800" },
            ].map((cat) => (
              <div key={cat.label} className="bold-badge text-base px-6 py-3" style={{ background: cat.color, color: cat.color === "#FFC800" ? "#1a1a1a" : "#fff" }} data-testid={`landing-cat-${cat.label.toLowerCase()}`}>
                {cat.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-[#1a1a1a] px-6 py-6" data-testid="landing-footer">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="font-heading font-semibold text-[#1a1a1a]">RecommendME</span>
          <span className="text-sm text-[#6b6b6b] font-body">A human-filtered taste exchange.</span>
        </div>
      </footer>
    </div>
  );
}
