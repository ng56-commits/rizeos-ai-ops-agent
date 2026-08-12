import React, { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, ArrowUpRight, Zap, Bolt,
  BookOpen, ChevronRight, ShieldCheck, LayoutDashboard,
  ListChecks, Settings as SettingsIcon, Sliders, Cpu, Loader2,
  Search, RefreshCw, Download, Send, ThumbsUp, ThumbsDown
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from "recharts";

const API_BASE = "http://127.0.0.1:8000";

function normalizeCase(raw) {
  const f = raw.finding;
  const d = raw.diagnosis || {};
  return {
    id: f.id,
    type: f.type,
    typeLabel: f.type.replace(/_/g, " "),
    user: f.raw_data.freelancer_name || f.raw_data.employer_name || f.raw_data.candidate_name || "Unknown user",
    detectedAt: f.detected_at,
    confidence: d.confidence ?? 0,
    status: raw.decision === "auto_resolve" ? "resolved" : "escalated",
    summary: f.summary,
    likelyCause: d.likely_cause || "—",
    evidence: d.supporting_evidence || "—",
    action: raw.decision === "auto_resolve"
      ? "Auto-resolved based on high-confidence diagnosis"
      : "Escalated to ops team for human review",
    error: raw.error,
    raw: f,
    diagnosis: d,
  };
}

const THRESHOLD_DEFAULT = 70;
const COLORS = { violet: "#6D5EF0", green: "#0F6E4E", greenBg: "#EAFBF4", amber: "#8A5606", amberBg: "#FFF4E5", red: "#B4231F", redBg: "#FDECEC" };

function Sidebar({ page, setPage }) {
  const NAV = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "queue", label: "Case queue", icon: ListChecks },
    { key: "playbook", label: "Playbook", icon: BookOpen },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];
  return (
    <div style={{ width: 190, background: "#F1EDFF", padding: "20px 12px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 26 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "#6D5EF0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Bolt size={17} color="#fff" />
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.25, color: "#1F1B2E" }}>RizeOS<br />Ops Agent</div>
      </div>
      {NAV.map((n) => {
        const active = page === n.key;
        return (
          <button key={n.key} onClick={() => setPage(n.key)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "10px 11px", marginBottom: 4, borderRadius: 10, border: "none",
            background: active ? "#6D5EF0" : "transparent",
            color: active ? "#fff" : "#5B5570", fontSize: 13, fontWeight: 500,
            cursor: "pointer", textAlign: "left",
          }}>
            <n.icon size={15} />
            {n.label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tint, textColor }) {
  return (
    <div style={{ background: tint || "#fff", borderRadius: 14, padding: 16, boxShadow: tint ? "none" : "0 1px 3px rgba(31,27,46,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: textColor || "#6B6580", marginBottom: 8 }}>
        <Icon size={14} /> {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: textColor || "#1F1B2E" }}>{value}</div>
    </div>
  );
}

function StatusChip({ status }) {
  const resolved = status === "resolved";
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
      color: resolved ? COLORS.green : COLORS.amber,
      background: resolved ? COLORS.greenBg : COLORS.amberBg,
    }}>
      {resolved ? "Resolved" : "Escalated"}
    </span>
  );
}

function OverviewPage({ cases, stats, onRescan, rescanning }) {
  const TREND = [
    { day: "Aug 6", caught: 4, resolved: 2, escalated: 2 },
    { day: "Aug 7", caught: 6, resolved: 3, escalated: 3 },
    { day: "Aug 8", caught: 5, resolved: 3, escalated: 2 },
    { day: "Aug 9", caught: 8, resolved: 5, escalated: 3 },
    { day: "Aug 10", caught: stats.total, resolved: stats.resolved, escalated: stats.escalated },
  ];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: "#6B6580" }}>Live snapshot of what the agent has caught today</div>
        <button onClick={onRescan} disabled={rescanning} style={{
          display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #E5E1F5",
          borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 500, color: "#6D5EF0", cursor: "pointer",
        }}>
          <RefreshCw size={14} className={rescanning ? "animate-spin" : ""} />
          {rescanning ? "Re-scanning..." : "Re-scan now"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <StatCard label="Cases caught" value={stats.total} icon={Zap} />
        <StatCard label="Auto-resolved" value={stats.resolved} icon={CheckCircle2} tint={COLORS.greenBg} textColor={COLORS.green} />
        <StatCard label="Escalated" value={stats.escalated} icon={ArrowUpRight} tint={COLORS.amberBg} textColor={COLORS.amber} />
        <StatCard label="Avg. confidence" value={`${stats.avgConf}%`} icon={ShieldCheck} tint="#F1EDFF" textColor="#4531B8" />
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(31,27,46,0.06)", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Cases over the last 5 days</div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={TREND}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EEF7" />
              <XAxis dataKey="day" stroke="#9992AC" fontSize={11} />
              <YAxis stroke="#9992AC" fontSize={11} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E1F5", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="resolved" stroke={COLORS.green} strokeWidth={2} name="Auto-resolved" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="escalated" stroke={COLORS.amber} strokeWidth={2} name="Escalated" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="caught" stroke={COLORS.violet} strokeWidth={2} strokeDasharray="4 3" name="Total caught" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 1px 3px rgba(31,27,46,0.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Recent cases</div>
        {cases.slice(0, 3).map((c, i) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", borderBottom: i < 2 ? "1px solid #F0EEF7" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: c.status === "resolved" ? COLORS.greenBg : COLORS.amberBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {c.status === "resolved" ? <CheckCircle2 size={16} color={COLORS.green} /> : <AlertTriangle size={16} color={COLORS.amber} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>{c.typeLabel}</div>
                <div style={{ fontSize: 11.5, color: "#6B6580" }}>{c.user} — {c.summary}</div>
              </div>
            </div>
            <StatusChip status={c.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CaseQueuePage({ cases, selectedId, setSelectedId, selected, threshold, onOverride, chatState, onAsk }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [question, setQuestion] = useState("");

  const filtered = cases.filter((c) => {
    const matchesFilter = filter === "all" || c.status === filter;
    const matchesQuery = query === "" ||
      c.typeLabel.toLowerCase().includes(query.toLowerCase()) ||
      c.user.toLowerCase().includes(query.toLowerCase()) ||
      c.summary.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const thread = chatState[selected?.id] || [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(31,27,46,0.06)", overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid #F0EEF7" }}>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={14} color="#9992AC" style={{ position: "absolute", left: 10, top: 10 }} />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cases..."
              style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: 10, border: "1px solid #E5E1F5", fontSize: 12.5, outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "escalated", "resolved"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                fontSize: 11, fontWeight: 500, padding: "5px 10px", borderRadius: 20, border: "none", cursor: "pointer",
                background: filter === f ? "#6D5EF0" : "#F1EDFF", color: filter === f ? "#fff" : "#5B5570", textTransform: "capitalize",
              }}>{f}</button>
            ))}
          </div>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: 20, fontSize: 12.5, color: "#9992AC", textAlign: "center" }}>No cases match.</div>
        )}
        {filtered.map((c) => {
          const active = c.id === selectedId;
          return (
            <button key={c.id} onClick={() => setSelectedId(c.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              background: active ? "#F8F6FF" : "transparent",
              borderLeft: active ? "3px solid #6D5EF0" : "3px solid transparent",
              border: "none", borderBottom: "1px solid #F5F3FB",
              padding: "12px 14px", cursor: "pointer",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 10.5, color: "#9992AC" }}>{c.id}</span>
                <Clock size={11} color="#B4AECF" />
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, textTransform: "capitalize" }}>{c.typeLabel}</div>
              <div style={{ fontSize: 11.5, color: "#6B6580", marginBottom: 8 }}>{c.summary}</div>
              <StatusChip status={c.status} />
            </button>
          );
        })}
      </div>

      {selected && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 22, boxShadow: "0 1px 3px rgba(31,27,46,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11.5, color: "#9992AC", marginBottom: 3 }}>{selected.id} · {selected.user}</div>
              <div style={{ fontSize: 19, fontWeight: 600, textTransform: "capitalize" }}>{selected.typeLabel}</div>
            </div>
            <StatusChip status={selected.status} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 11.5, color: "#6B6580" }}>Confidence</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: selected.confidence >= threshold ? COLORS.green : COLORS.amber }}>{selected.confidence}%</span>
            </div>
            <div style={{ position: "relative", height: 7, background: "#F0EEF7", borderRadius: 4 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${selected.confidence}%`, background: selected.confidence >= threshold ? "#2FBE85" : "#F5A623", borderRadius: 4 }} />
              <div style={{ position: "absolute", left: `${threshold}%`, top: -2, bottom: -2, width: 2, background: "#1F1B2E", opacity: 0.25 }} />
            </div>
          </div>

          <div style={{ background: "#F8F6FF", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#5943D6", marginBottom: 6 }}>LIKELY CAUSE</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "#1F1B2E", marginBottom: 10 }}>{selected.likelyCause}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#5943D6", marginBottom: 6 }}>SUPPORTING EVIDENCE</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "#4A4560" }}>{selected.evidence}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: selected.status === "resolved" ? COLORS.green : COLORS.amber, marginBottom: 16 }}>
            {selected.status === "resolved" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span style={{ fontWeight: 500 }}>{selected.action}</span>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <button onClick={() => onOverride(selected, "resolved")} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: COLORS.greenBg, color: COLORS.green, border: "none", borderRadius: 10, padding: "9px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}><ThumbsUp size={13} /> Mark resolved</button>
            <button onClick={() => onOverride(selected, "escalated")} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: COLORS.amberBg, color: COLORS.amber, border: "none", borderRadius: 10, padding: "9px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}><ThumbsDown size={13} /> Escalate anyway</button>
          </div>

          <div style={{ borderTop: "1px solid #F0EEF7", paddingTop: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#6B6580", marginBottom: 10 }}>ASK THE AGENT ABOUT THIS CASE</div>
            <div style={{ maxHeight: 140, overflowY: "auto", marginBottom: 10 }}>
              {thread.length === 0 && <div style={{ fontSize: 12, color: "#B4AECF" }}>No questions asked yet.</div>}
              {thread.map((m, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#1F1B2E", marginBottom: 2 }}>You: {m.question}</div>
                  <div style={{ fontSize: 12, color: "#4A4560", background: "#F8F6FF", borderRadius: 8, padding: "6px 10px" }}>{m.loading ? "Thinking..." : m.answer}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={question} onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && question.trim()) { onAsk(selected, question); setQuestion(""); } }}
                placeholder="e.g. why not auto-resolve this?"
                style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #E5E1F5", fontSize: 12.5, outline: "none" }}
              />
              <button onClick={() => { if (question.trim()) { onAsk(selected, question); setQuestion(""); } }} style={{
                background: "#6D5EF0", border: "none", borderRadius: 10, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center",
              }}><Send size={14} color="#fff" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaybookPage({ playbook, loading }) {
  const chartData = (playbook?.patterns || []).map((p) => ({ name: p.pattern.replace(/_/g, " "), count: p.times_handled }));
  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(31,27,46,0.06)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <BookOpen size={16} color="#6D5EF0" />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Learned playbook</div>
        </div>
        <p style={{ fontSize: 12.5, color: "#6B6580", marginTop: 6 }}>
          Real history — every time you mark a case resolved or escalated, it's logged here. This is not a mockup.
        </p>
      </div>

      {loading && <div style={{ fontSize: 13, color: "#9992AC" }}>Loading...</div>}

      {!loading && chartData.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(31,27,46,0.06)", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Times each pattern handled</div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEF7" horizontal={false} />
                <XAxis type="number" stroke="#9992AC" fontSize={11} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="#9992AC" fontSize={11} width={110} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E1F5", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#6D5EF0" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(31,27,46,0.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Activity log</div>
        {(!playbook?.log || playbook.log.length === 0) && (
          <div style={{ fontSize: 12.5, color: "#9992AC" }}>No overrides logged yet — mark a case resolved or escalated in the Case Queue to see it appear here.</div>
        )}
        {(playbook?.log || []).map((entry, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 4px", borderBottom: i < playbook.log.length - 1 ? "1px solid #F5F3FB" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ChevronRight size={13} color="#B4AECF" />
              <span style={{ fontSize: 12.5, textTransform: "capitalize" }}>{entry.finding_type.replace(/_/g, " ")} — {entry.finding_id}</span>
            </div>
            <StatusChip status={entry.action} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage({ threshold, setThreshold, onExport }) {
  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(31,27,46,0.06)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Sliders size={16} color="#6D5EF0" />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Routing threshold</div>
        </div>
        <p style={{ fontSize: 12.5, color: "#6B6580", marginBottom: 16 }}>
          Cases at or above this confidence are treated as auto-resolved. Below it, they're treated as needing human review — the safety gate from the hallucination mitigation plan.
        </p>
        <input type="range" min={40} max={95} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} style={{ width: "100%", accentColor: "#6D5EF0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#9992AC" }}>
          <span>40% (more automation)</span>
          <span style={{ fontWeight: 600, color: "#6D5EF0", fontSize: 13 }}>{threshold}%</span>
          <span>95% (more caution)</span>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(31,27,46,0.06)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Cpu size={16} color="#6D5EF0" />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Pipeline configuration</div>
        </div>
        {[
          { label: "LLM", value: "Groq — Llama 3.1 8B Instant" },
          { label: "Orchestration", value: "LangGraph state machine" },
          { label: "Data source", value: "Live FastAPI backend" },
          { label: "Evidence citation", value: "Required on every diagnosis" },
        ].map((row) => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0" }}>
            <span style={{ color: "#6B6580" }}>{row.label}</span>
            <span style={{ color: "#1F1B2E", fontWeight: 500 }}>{row.value}</span>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(31,27,46,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Download size={16} color="#6D5EF0" />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Export report</div>
        </div>
        <p style={{ fontSize: 12.5, color: "#6B6580", marginBottom: 14 }}>Download all current cases and diagnoses as JSON.</p>
        <button onClick={onExport} style={{
          background: "#6D5EF0", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        }}>Download JSON</button>
      </div>
    </div>
  );
}

export default function OpsAgentApp() {
  const [page, setPage] = useState("overview");
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [threshold, setThreshold] = useState(THRESHOLD_DEFAULT);
  const [playbook, setPlaybook] = useState(null);
  const [playbookLoading, setPlaybookLoading] = useState(true);
  const [chatState, setChatState] = useState({});

  const loadCases = () => {
    return fetch(`${API_BASE}/cases`)
      .then((res) => { if (!res.ok) throw new Error(`Backend responded with ${res.status}`); return res.json(); })
      .then((data) => {
        const normalized = data.map(normalizeCase);
        setCases(normalized);
        if (normalized.length > 0 && !selectedId) setSelectedId(normalized[0].id);
        return normalized;
      });
  };

  const loadPlaybook = () => {
    setPlaybookLoading(true);
    return fetch(`${API_BASE}/playbook`)
      .then((res) => res.json())
      .then((data) => { setPlaybook(data); setPlaybookLoading(false); })
      .catch(() => setPlaybookLoading(false));
  };

  useEffect(() => {
    loadCases().then(() => setLoading(false)).catch((err) => { setFetchError(err.message); setLoading(false); });
    loadPlaybook();
  }, []);

  const handleRescan = () => {
    setRescanning(true);
    loadCases().finally(() => setRescanning(false));
  };

  const handleOverride = (caseObj, action) => {
    fetch(`${API_BASE}/cases/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finding_id: caseObj.id, finding_type: caseObj.type, action, note: "" }),
    })
      .then(() => {
        setCases((prev) => prev.map((c) => c.id === caseObj.id ? { ...c, status: action } : c));
        loadPlaybook();
      })
      .catch(() => {});
  };

  const handleAsk = (caseObj, question) => {
    setChatState((prev) => ({
      ...prev,
      [caseObj.id]: [...(prev[caseObj.id] || []), { question, answer: "", loading: true }],
    }));
    fetch(`${API_BASE}/cases/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finding: caseObj.raw, diagnosis: caseObj.diagnosis, question }),
    })
      .then((res) => res.json())
      .then((data) => {
        setChatState((prev) => {
          const thread = [...(prev[caseObj.id] || [])];
          thread[thread.length - 1] = { question, answer: data.answer, loading: false };
          return { ...prev, [caseObj.id]: thread };
        });
      });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(cases, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rizeos-ops-agent-report.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const selected = useMemo(() => cases.find((c) => c.id === selectedId), [cases, selectedId]);
  const stats = useMemo(() => {
    if (cases.length === 0) return { total: 0, resolved: 0, escalated: 0, avgConf: 0 };
    const resolved = cases.filter((c) => c.status === "resolved").length;
    return { total: cases.length, resolved, escalated: cases.length - resolved, avgConf: Math.round(cases.reduce((s, c) => s + c.confidence, 0) / cases.length) };
  }, [cases]);

  if (loading) {
    return (
      <div style={{ fontFamily: "Inter,-apple-system,sans-serif", background: "#FAF9F7", color: "#6B6580", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <Loader2 size={18} className="animate-spin" /> Connecting to agent backend...
      </div>
    );
  }
  if (fetchError) {
    return (
      <div style={{ fontFamily: "Inter,-apple-system,sans-serif", background: "#FAF9F7", color: "#1F1B2E", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 20 }}>
        <AlertTriangle size={24} color={COLORS.amber} />
        <div style={{ fontWeight: 600 }}>Couldn't reach the backend</div>
        <div style={{ fontSize: 13, color: "#6B6580", textAlign: "center", maxWidth: 400 }}>{fetchError}. Make sure the FastAPI server is running at {API_BASE}.</div>
      </div>
    );
  }

  const TITLES = { overview: "Overview", queue: "Case queue", playbook: "Playbook", settings: "Settings" };

  return (
    <div style={{ fontFamily: "Inter,-apple-system,sans-serif", background: "#FAF9F7", color: "#1F1B2E", minHeight: "100vh", display: "flex" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; } @keyframes spin { to { transform: rotate(360deg); } } .animate-spin { animation: spin 1s linear infinite; }`}</style>
      <Sidebar page={page} setPage={setPage} />
      <div style={{ flex: 1, padding: "24px 28px 40px", overflowX: "auto" }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{TITLES[page]}</div>
        {page === "overview" && <OverviewPage cases={cases} stats={stats} onRescan={handleRescan} rescanning={rescanning} />}
        {page === "queue" && (
          <CaseQueuePage cases={cases} selectedId={selectedId} setSelectedId={setSelectedId} selected={selected} threshold={threshold} onOverride={handleOverride} chatState={chatState} onAsk={handleAsk} />
        )}
        {page === "playbook" && <PlaybookPage playbook={playbook} loading={playbookLoading} />}
        {page === "settings" && <SettingsPage threshold={threshold} setThreshold={setThreshold} onExport={handleExport} />}
      </div>
    </div>
  );
}