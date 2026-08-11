import React, { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, ArrowUpRight, Zap,
  BookOpen, Activity, ChevronRight, ShieldCheck, LayoutDashboard,
  ListChecks, Settings as SettingsIcon, Sliders, Cpu, Loader2
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from "recharts";

// Backend API base URL — change this if your FastAPI server runs elsewhere
const API_BASE = "http://127.0.0.1:8000";

// Turns a raw /cases API response into the shape the dashboard components expect
function normalizeCase(raw) {
  const f = raw.finding;
  const d = raw.diagnosis || {};
  return {
    id: f.id,
    type: f.type.replace(/_/g, " "),
    user: f.raw_data.freelancer_name || f.raw_data.employer_name || f.raw_data.candidate_name || "Unknown user",
    detectedAgo: new Date(f.detected_at).toLocaleString(),
    confidence: d.confidence ?? 0,
    status: raw.decision === "auto_resolve" ? "resolved" : "escalated",
    summary: f.summary,
    evidence: [
      { label: "Likely cause", detail: d.likely_cause || "—" },
      { label: "Supporting evidence", detail: d.supporting_evidence || "—" },
    ],
    reasoning: d.likely_cause
      ? `${d.likely_cause} ${d.supporting_evidence ? "Based on: " + d.supporting_evidence : ""}`
      : "No diagnosis available.",
    action: raw.decision === "auto_resolve"
      ? "Auto-resolved based on high-confidence diagnosis"
      : "Escalated to ops team for human review",
    error: raw.error,
  };
}

const PLAYBOOK = [
  { pattern: "Bank processing delay (matched history)", handledAuto: true, learnedFrom: "12 prior human resolutions", addedOn: "Jul 28" },
  { pattern: "Inactive employer, no application view", handledAuto: true, learnedFrom: "8 prior human resolutions", addedOn: "Aug 1" },
  { pattern: "Account number mismatch on payment", handledAuto: false, learnedFrom: "Still routed to human — pattern still forming", addedOn: "—" },
  { pattern: "Low OCR confidence on verification docs", handledAuto: false, learnedFrom: "Still routed to human — pattern still forming", addedOn: "—" },
];

const TREND = [
  { day: "Aug 1", caught: 4, resolved: 2, escalated: 2 },
  { day: "Aug 2", caught: 6, resolved: 3, escalated: 3 },
  { day: "Aug 3", caught: 5, resolved: 3, escalated: 2 },
  { day: "Aug 4", caught: 8, resolved: 5, escalated: 3 },
  { day: "Aug 5", caught: 7, resolved: 5, escalated: 2 },
  { day: "Aug 6", caught: 9, resolved: 7, escalated: 2 },
];

const THRESHOLD_DEFAULT = 70;

function ConfidenceGauge({ value, threshold }) {
  const resolved = value >= threshold;
  const color = resolved ? "#2DD4BF" : "#F5A623";
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#8592A8" }}>CONFIDENCE</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color, fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ position: "relative", height: 8, background: "#1A2540", borderRadius: 4 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${value}%`, background: color, borderRadius: 4, transition: "width 0.4s ease" }} />
        <div title={`Auto-resolve threshold: ${threshold}%`} style={{ position: "absolute", left: `${threshold}%`, top: -3, bottom: -3, width: 2, background: "#E7ECF3", opacity: 0.5 }} />
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#5A6780", marginTop: 4 }}>
        threshold {threshold}% — {resolved ? "above → auto-resolved" : "below → escalated to human"}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const resolved = status === "resolved";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600,
      letterSpacing: 0.4, textTransform: "uppercase", padding: "3px 9px", borderRadius: 20,
      color: resolved ? "#2DD4BF" : "#F5A623",
      background: resolved ? "rgba(45,212,191,0.1)" : "rgba(245,166,35,0.1)",
      border: `1px solid ${resolved ? "rgba(45,212,191,0.35)" : "rgba(245,166,35,0.35)"}`,
    }}>
      {resolved ? <CheckCircle2 size={12} /> : <ArrowUpRight size={12} />}
      {resolved ? "Auto-resolved" : "Escalated"}
    </span>
  );
}

function Panel({ children, style }) {
  return <div style={{ background: "#131C2E", border: "1px solid #223049", borderRadius: 12, ...style }}>{children}</div>;
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 12, color: "#8592A8", fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>
      {children}
    </div>
  );
}

function OverviewPage({ stats }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        {[
          { label: "Cases caught", value: stats.total, icon: Zap, color: "#8B7CF6" },
          { label: "Auto-resolved", value: stats.resolved, icon: CheckCircle2, color: "#2DD4BF" },
          { label: "Escalated", value: stats.escalated, icon: ArrowUpRight, color: "#F5A623" },
          { label: "Avg. confidence", value: `${stats.avgConf}%`, icon: ShieldCheck, color: "#60A5FA" },
        ].map((s) => (
          <Panel key={s.label} style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#8592A8", fontSize: 12, marginBottom: 8 }}>
              <s.icon size={13} color={s.color} /> {s.label}
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 24, fontWeight: 700 }}>{s.value}</div>
          </Panel>
        ))}
      </div>

      <Panel style={{ padding: 20, marginBottom: 18 }}>
        <SectionLabel>Cases over the last 6 days</SectionLabel>
        <div style={{ height: 220, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={TREND}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A2540" />
              <XAxis dataKey="day" stroke="#5A6780" fontSize={11} />
              <YAxis stroke="#5A6780" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0E1626", border: "1px solid #223049", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="resolved" stroke="#2DD4BF" strokeWidth={2} name="Auto-resolved" dot={false} />
              <Line type="monotone" dataKey="escalated" stroke="#F5A623" strokeWidth={2} name="Escalated" dot={false} />
              <Line type="monotone" dataKey="caught" stroke="#8B7CF6" strokeWidth={2} strokeDasharray="4 3" name="Total caught" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel style={{ padding: 20 }}>
        <SectionLabel>What this means</SectionLabel>
        <p style={{ fontSize: 13, color: "#C9D2E0", lineHeight: 1.6, marginTop: 10 }}>
          Auto-resolution rate is trending up (from 50% on Aug 1 to ~78% on Aug 6) as the playbook
          picks up more resolved patterns — the system needs less human intervention over time
          rather than staying static.
        </p>
      </Panel>
    </div>
  );
}

function CaseQueuePage({ cases, selectedId, setSelectedId, selected, threshold }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
      <Panel style={{ overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #223049" }}>
          <SectionLabel>Case Queue</SectionLabel>
        </div>
        {cases.map((c) => {
          const active = c.id === selectedId;
          return (
            <button key={c.id} onClick={() => setSelectedId(c.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              background: active ? "rgba(139,124,246,0.08)" : "transparent",
              borderLeft: active ? "3px solid #8B7CF6" : "3px solid transparent",
              border: "none", borderBottom: "1px solid #1A2540",
              padding: "12px 14px", cursor: "pointer", color: "#E7ECF3",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5A6780" }}>{c.id}</span>
                <Clock size={11} color="#5A6780" />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{c.type}</div>
              <div style={{ fontSize: 11.5, color: "#8592A8", marginBottom: 8, lineHeight: 1.4 }}>{c.summary}</div>
              <StatusBadge status={c.status} />
            </button>
          );
        })}
      </Panel>

      {selected && (
        <Panel style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#5A6780", marginBottom: 3 }}>
                {selected.id} &middot; {selected.user} &middot; detected {selected.detectedAgo}
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 19, fontWeight: 700 }}>{selected.type}</div>
            </div>
            <StatusBadge status={selected.status} />
          </div>

          <div style={{ margin: "18px 0" }}>
            <ConfidenceGauge value={selected.confidence} threshold={threshold} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Evidence trail</SectionLabel>
            <div style={{ marginTop: 10 }}>
              {selected.evidence.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                  <div style={{
                    minWidth: 20, height: 20, borderRadius: "50%", background: "rgba(139,124,246,0.15)",
                    color: "#8B7CF6", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
                  }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#C9D2E0", marginBottom: 2 }}>{e.label}</div>
                    <div style={{ fontSize: 12.5, color: "#8592A8", lineHeight: 1.5, fontFamily: "'IBM Plex Mono', monospace" }}>{e.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#0E1626", border: "1px solid #1A2540", borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <SectionLabel>Agent reasoning</SectionLabel>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#C9D2E0", marginTop: 6 }}>{selected.reasoning}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: selected.status === "resolved" ? "#2DD4BF" : "#F5A623" }}>
            {selected.status === "resolved" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span style={{ fontWeight: 500 }}>{selected.action}</span>
          </div>
        </Panel>
      )}
    </div>
  );
}

function PlaybookPage() {
  const chartData = [
    { name: "Payment delays", auto: 12 },
    { name: "Inactive employer", auto: 8 },
    { name: "Account mismatch", auto: 0 },
    { name: "Low OCR docs", auto: 0 },
  ];
  return (
    <div>
      <Panel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <BookOpen size={16} color="#8B7CF6" />
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 700 }}>Learned Playbook</div>
        </div>
        <p style={{ fontSize: 12.5, color: "#8592A8", marginTop: 6 }}>
          Patterns the agent has picked up from human resolutions — once a pattern repeats
          enough with consistent outcomes, it moves from "learning" to "auto-handled."
        </p>
      </Panel>

      <Panel style={{ padding: 20, marginBottom: 16 }}>
        <SectionLabel>Times each pattern has been auto-handled</SectionLabel>
        <div style={{ height: 200, marginTop: 14 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A2540" horizontal={false} />
              <XAxis type="number" stroke="#5A6780" fontSize={11} />
              <YAxis dataKey="name" type="category" stroke="#5A6780" fontSize={11} width={120} />
              <Tooltip contentStyle={{ background: "#0E1626", border: "1px solid #223049", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="auto" fill="#8B7CF6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel style={{ padding: 20 }}>
        <SectionLabel>All patterns</SectionLabel>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {PLAYBOOK.map((p, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", background: "#0E1626", borderRadius: 8, border: "1px solid #1A2540", flexWrap: "wrap", gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ChevronRight size={13} color="#5A6780" />
                <span style={{ fontSize: 13, color: "#C9D2E0" }}>{p.pattern}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11.5, color: "#5A6780", fontFamily: "'IBM Plex Mono', monospace" }}>{p.learnedFrom}</span>
                <span style={{
                  fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                  color: p.handledAuto ? "#2DD4BF" : "#8592A8",
                  background: p.handledAuto ? "rgba(45,212,191,0.1)" : "rgba(133,146,168,0.1)",
                }}>{p.handledAuto ? "AUTO-HANDLED" : "LEARNING"}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SettingsPage({ threshold, setThreshold }) {
  return (
    <div>
      <Panel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Sliders size={16} color="#8B7CF6" />
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 700 }}>Routing threshold</div>
        </div>
        <p style={{ fontSize: 12.5, color: "#8592A8", marginBottom: 16 }}>
          Cases at or above this confidence are auto-resolved. Anything below is escalated to a human,
          regardless of how routine it looks — this is the safety gate from the hallucination
          mitigation plan.
        </p>
        <input
          type="range" min={40} max={95} value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#8B7CF6" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5A6780" }}>40% (more automation)</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#8B7CF6", fontWeight: 700 }}>{threshold}%</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5A6780" }}>95% (more caution)</span>
        </div>
      </Panel>

      <Panel style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Cpu size={16} color="#8B7CF6" />
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, fontWeight: 700 }}>Pipeline configuration</div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { label: "LLM", value: "Groq — Llama 3.1 8B Instant" },
            { label: "Orchestration", value: "LangGraph state machine" },
            { label: "Data source", value: "Mock platform DB (MySQL)" },
            { label: "Evidence citation", value: "Required on every diagnosis" },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#8592A8" }}>{row.label}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#C9D2E0" }}>{row.value}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

const NAV = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "queue", label: "Case Queue", icon: ListChecks },
  { key: "playbook", label: "Playbook", icon: BookOpen },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

export default function OpsAgentApp() {
  const [page, setPage] = useState("overview");
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [threshold, setThreshold] = useState(THRESHOLD_DEFAULT);

  useEffect(() => {
    fetch(`${API_BASE}/cases`)
      .then((res) => {
        if (!res.ok) throw new Error(`Backend responded with ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const normalized = data.map(normalizeCase);
        setCases(normalized);
        if (normalized.length > 0) setSelectedId(normalized[0].id);
        setLoading(false);
      })
      .catch((err) => {
        setFetchError(err.message);
        setLoading(false);
      });
  }, []);

  const selected = useMemo(() => cases.find((c) => c.id === selectedId), [cases, selectedId]);

  const stats = useMemo(() => {
    if (cases.length === 0) return { total: 0, resolved: 0, escalated: 0, avgConf: 0 };
    const resolved = cases.filter((c) => c.status === "resolved").length;
    const escalated = cases.length - resolved;
    const avgConf = Math.round(cases.reduce((s, c) => s + c.confidence, 0) / cases.length);
    return { total: cases.length, resolved, escalated, avgConf };
  }, [cases]);

  if (loading) {
    return (
      <div style={{
        fontFamily: "'Inter', -apple-system, sans-serif", background: "#0B1220", color: "#8592A8",
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <Loader2 size={18} className="animate-spin" />
        Connecting to agent backend...
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{
        fontFamily: "'Inter', -apple-system, sans-serif", background: "#0B1220", color: "#E7ECF3",
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 20,
      }}>
        <AlertTriangle size={24} color="#F5A623" />
        <div style={{ fontWeight: 600 }}>Couldn't reach the backend</div>
        <div style={{ fontSize: 13, color: "#8592A8", textAlign: "center", maxWidth: 400 }}>
          {fetchError}. Make sure the FastAPI server is running at {API_BASE} (uvicorn app.main:app --reload).
        </div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif", background: "#0B1220", color: "#E7ECF3",
      minHeight: "100vh", display: "flex",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        button:focus-visible { outline: 2px solid #8B7CF6; outline-offset: -2px; }
      `}</style>

      <div style={{ width: 200, borderRight: "1px solid #223049", padding: "20px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 26 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg,#8B7CF6,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Activity size={16} color="#fff" />
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
            RizeOS<br />Ops Agent
          </div>
        </div>
        {NAV.map((n) => {
          const active = page === n.key;
          return (
            <button key={n.key} onClick={() => setPage(n.key)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "9px 10px", marginBottom: 4, borderRadius: 8, border: "none",
              background: active ? "rgba(139,124,246,0.12)" : "transparent",
              color: active ? "#C9BFFB" : "#8592A8", fontSize: 13, fontWeight: 500,
              cursor: "pointer", textAlign: "left",
            }}>
              <n.icon size={15} color={active ? "#8B7CF6" : "#5A6780"} />
              {n.label}
            </button>
          );
        })}
        <div style={{ marginTop: 24, padding: "10px 10px", borderRadius: 8, background: "#131C2E", border: "1px solid #223049" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#2DD4BF", fontFamily: "'IBM Plex Mono', monospace" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2DD4BF", boxShadow: "0 0 6px #2DD4BF" }} />
            LIVE
          </div>
          <div style={{ fontSize: 10.5, color: "#5A6780", marginTop: 4 }}>Monitoring active</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: "24px 28px 40px", overflowX: "auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 20, fontWeight: 700 }}>
            {NAV.find((n) => n.key === page)?.label}
          </div>
          <div style={{ fontSize: 12.5, color: "#8592A8" }}>
            {page === "overview" && "Live snapshot of what the agent has caught and resolved"}
            {page === "queue" && "Every case the monitor agent has flagged, with full reasoning"}
            {page === "playbook" && "What the agent has learned to handle on its own"}
            {page === "settings" && "Tune how cautious the agent is, and see the pipeline config"}
          </div>
        </div>

        {page === "overview" && <OverviewPage stats={stats} />}
        {page === "queue" && (
          <CaseQueuePage cases={cases} selectedId={selectedId} setSelectedId={setSelectedId} selected={selected} threshold={threshold} />
        )}
        {page === "playbook" && <PlaybookPage />}
        {page === "settings" && <SettingsPage threshold={threshold} setThreshold={setThreshold} />}
      </div>
    </div>
  );
}