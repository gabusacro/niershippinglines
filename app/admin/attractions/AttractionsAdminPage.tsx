"use client";

import { useState } from "react";
import {
  Upload, Image as ImageIcon, Sparkles, Search, Plus,
  ChevronRight, Tag, Clock, MapPin, FileText, Globe,
  Wand2, Check, Loader2, Trash2, Save, ArrowLeft, Eye, AlignLeft,
  LayoutDashboard, AlertCircle, CheckCircle2, AlertTriangle,
  Link, ExternalLink, Trash,
} from "lucide-react";
import { RichDescriptionEditor } from "@/components/attractions/RichDescriptionEditor";
import type { Attraction, AttractionForm, AutoLink, LayoutStyle } from "@/lib/attractions/types";
import { MultiPhotoUpload } from "@/components/attractions/MultiPhotoUpload";
import { EMPTY_FORM, GRADIENTS, CATEGORIES, LAYOUT_STYLES } from "@/lib/attractions/types";
import { AdsAdminPage } from "./AdsAdminPage";

type Photo = { url: string; alt: string };

// ── SEO health ────────────────────────────────────────────────────────────────
type SeoHealth = { score: number; status: "good"|"warn"|"poor"; missing: string[]; passed: string[] };

function getSeoHealth(item: Attraction): SeoHealth {
  const missing: string[] = [];
  const passed:  string[] = [];
  const hasPhoto = !!(item.image_url || (item as any).photos?.length);
  hasPhoto ? passed.push("Photo") : missing.push("Photo");
  const wordCount = item.description?.split(/\s+/).filter(Boolean).length ?? 0;
  wordCount >= 80 ? passed.push("Description") : missing.push(wordCount > 0 ? `Description too short (${wordCount} words)` : "Description");
  const hasMeta = !!((item as any).meta_description?.trim());
  hasMeta ? passed.push("Meta description") : missing.push("Meta description");
  const tagCount = item.seo_tags?.length ?? 0;
  tagCount >= 3 ? passed.push("SEO tags") : missing.push(tagCount > 0 ? `Need more tags (${tagCount}/3)` : "SEO tags");
  item.is_published ? passed.push("Published") : missing.push("Not published");
  const score  = Math.round((passed.length / 5) * 100);
  const status = score === 100 ? "good" : score >= 60 ? "warn" : "poor";
  return { score, status, missing, passed };
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
}

function SeoBadge({ health }: { health: SeoHealth }) {
  const cfg = {
    good: { bg: "#DCFCE7", text: "#166534", border: "#BBF7D0", label: "SEO Ready",   icon: <CheckCircle2  className="w-3 h-3" /> },
    warn: { bg: "#FEF9C3", text: "#854D0E", border: "#FDE047", label: "Needs Work",  icon: <AlertTriangle className="w-3 h-3" /> },
    poor: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5", label: "Missing SEO", icon: <AlertCircle   className="w-3 h-3" /> },
  }[health.status];
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,background:cfg.bg,color:cfg.text,border:`1px solid ${cfg.border}`,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:999,textTransform:"uppercase",letterSpacing:"0.05em" }}>
      {cfg.icon}{cfg.label} {health.score}%
    </span>
  );
}

// ── Dashboard header ──────────────────────────────────────────────────────────
function DashboardHeader({ items }: { items: Attraction[] }) {
  const healths   = items.map(getSeoHealth);
  const good      = healths.filter((h) => h.status === "good").length;
  const warn      = healths.filter((h) => h.status === "warn").length;
  const poor      = healths.filter((h) => h.status === "poor").length;
  const avgScore  = healths.length ? Math.round(healths.reduce((s, h) => s + h.score, 0) / healths.length) : 0;
  const published = items.filter((i) => i.is_published).length;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 mb-5">
      <div className="flex items-center gap-3 mb-4">
        <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#085C52,#0c7b93)",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <LayoutDashboard className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 style={{ fontSize:18,fontWeight:700,color:"#111827",lineHeight:1.2 }}>Attractions Dashboard</h1>
          <p style={{ fontSize:12,color:"#6B7280",marginTop:1 }}>Manage content · Monitor SEO health · Publish</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label:"Total",     value:items.length,   color:"#0c7b93", bg:"#E0F7F4" },
          { label:"Published", value:published,       color:"#085C52", bg:"#DCFCE7" },
          { label:"SEO ready", value:good,            color:"#166534", bg:"#DCFCE7" },
          { label:"Avg SEO",   value:`${avgScore}%`,  color:avgScore>=80?"#166534":avgScore>=50?"#854D0E":"#991B1B", bg:avgScore>=80?"#DCFCE7":avgScore>=50?"#FEF9C3":"#FEE2E2" },
        ].map((s) => (
          <div key={s.label} style={{ background:s.bg,borderRadius:12,padding:"12px 10px",textAlign:"center" }}>
            <div style={{ fontSize:22,fontWeight:800,color:s.color,lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:10,fontWeight:600,color:s.color,opacity:0.7,marginTop:3,textTransform:"uppercase",letterSpacing:"0.06em" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p style={{ fontSize:11,fontWeight:600,color:"#6B7280" }}>SEO health overview</p>
          <p style={{ fontSize:11,color:"#9CA3AF" }}>{good} ready · {warn} need work · {poor} missing SEO</p>
        </div>
        <div style={{ height:8,borderRadius:999,background:"#F1F5F9",overflow:"hidden",display:"flex" }}>
          {good > 0 && <div style={{ flex:good,background:"#22C55E",transition:"flex 0.5s ease" }} />}
          {warn > 0 && <div style={{ flex:warn,background:"#EAB308",transition:"flex 0.5s ease" }} />}
          {poor > 0 && <div style={{ flex:poor,background:"#EF4444",transition:"flex 0.5s ease" }} />}
          {items.length === 0 && <div style={{ flex:1,background:"#E2E8F0" }} />}
        </div>
      </div>
    </div>
  );
}

function SeoPreview({ title, metaDescription, slug }: { title:string; metaDescription:string; slug:string }) {
  const url      = `travelasiargao.com/attractions/${slug || slugify(title) || "attraction-name"}`;
  const metaTitle = title ? `${title} — Siargao Island | Travela Siargao` : "Title | Travela Siargao";
  const metaDesc  = metaDescription || "Discover the best of Siargao Island.";
  const titleOk   = metaTitle.length <= 65;
  const descOk    = metaDesc.length  <= 160;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Google preview</p>
      </div>
      <p className="text-[11px] text-green-700 mb-0.5 font-medium truncate">{url}</p>
      <p className={`text-[16px] font-medium mb-1 truncate ${titleOk ? "text-blue-700" : "text-red-600"}`}>{metaTitle}</p>
      <p className={`text-[13px] leading-relaxed ${descOk ? "text-slate-600" : "text-red-500"}`}>{metaDesc.slice(0,160)}{metaDesc.length>160?"…":""}</p>
      <div className="flex gap-4 mt-2 text-[10px]">
        <span className={titleOk ? "text-green-600" : "text-red-500"}>Title: {metaTitle.length}/65</span>
        <span className={descOk  ? "text-green-600" : "text-red-500"}>Meta desc: {metaDesc.length}/160</span>
      </div>
    </div>
  );
}

function TagInput({ tags, onChange }: { tags:string[]; onChange:(t:string[])=>void }) {
  const [input, setInput] = useState("");
  function add() { const v=input.trim(); if(v&&!tags.includes(v)) onChange([...tags,v]); setInput(""); }
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input type="text" value={input} onChange={(e)=>setInput(e.target.value)}
          onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();add();}}}
          placeholder="e.g. siargao tourist spots 2026"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-[#0c7b93]" />
        <button type="button" onClick={add} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[12px] font-medium hover:bg-slate-200">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] rounded-full px-2.5 py-0.5 text-[11px] font-medium">
              <Tag className="w-2.5 h-2.5" />{tag}
              <button type="button" onClick={()=>onChange(tags.filter((t)=>t!==tag))} className="text-[#085041]/50 hover:text-[#085041] ml-0.5 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HeroPositionPicker({ value, onChange, imageUrl }: { value:string; onChange:(v:string)=>void; imageUrl?:string }) {
  const positions = [
    { label:"Top",    value:"center top",    hint:"Sky / treetops" },
    { label:"30%",    value:"center 30%",    hint:"Above center" },
    { label:"Center", value:"center center", hint:"Default" },
    { label:"50%",    value:"center 50%",    hint:"True middle" },
    { label:"60%",    value:"center 60%",    hint:"Below center" },
    { label:"Bottom", value:"center bottom", hint:"Foreground" },
  ];
  return (
    <div className="space-y-3">
      {imageUrl && (
        <div className="rounded-xl overflow-hidden border border-slate-200 relative" style={{ height:130 }}>
          <img src={imageUrl} alt="Hero crop preview" className="w-full h-full object-cover transition-all duration-300" style={{ objectPosition:value }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
            <p className="text-white text-[11px] font-semibold">Live preview</p>
            <span className="text-white/70 text-[10px] font-mono bg-black/30 px-2 py-0.5 rounded-full">{value}</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {positions.map((p) => (
          <button key={p.value} type="button" onClick={()=>onChange(p.value)}
            className={`rounded-xl border p-2.5 text-left transition-all ${value===p.value?"border-[#0c7b93] bg-[#E0F7F4] text-[#085C52]":"border-slate-200 bg-white text-slate-600 hover:border-[#0c7b93]"}`}>
            <div className="text-[12px] font-bold">{p.label}</div>
            <div className="text-[10px] opacity-60 mt-0.5">{p.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function getAiErrorMessage(data: any): string {
  const msg = data?.error ?? data?.message ?? "";
  if (msg.includes("credit balance")||msg.includes("too low")) return "⚠️ No Anthropic credits — go to console.anthropic.com → Billing → add $5.";
  if (msg.includes("API key")) return "⚠️ Invalid API key — check ANTHROPIC_API_KEY in Vercel env.";
  return "AI generation failed — try again.";
}

// ── Auto-link rules manager ───────────────────────────────────────────────────
function AutoLinkManager({ links, onChange }: { links: AutoLink[]; onChange: (l: AutoLink[]) => void }) {
  const [phrase,     setPhrase]     = useState("");
  const [url,        setUrl]        = useState("");
  const [type,       setType]       = useState<"internal"|"external">("internal");
  const [occurrence, setOccurrence] = useState<"first"|"second"|"all">("first");

  function add() {
    if (!phrase.trim() || !url.trim()) return;
    if (links.length >= 8) { alert("Maximum 8 links allowed."); return; }
    onChange([...links, { phrase: phrase.trim(), url: url.trim(), type, occurrence }]);
    setPhrase(""); setUrl("");
  }

  const internalPaths = ["/tours", "/book", "/attractions", "/weather", "/parking"];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <p style={{ fontSize:11,fontWeight:700,color:"#374151" }}>Add link rule</p>

        {/* Phrase */}
        <div>
          <label style={{ fontSize:10,color:"#6B7280",fontWeight:600,display:"block",marginBottom:3 }}>Target phrase (exact words in content)</label>
          <input value={phrase} onChange={(e)=>setPhrase(e.target.value)}
            placeholder='e.g. Siargao Island'
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:border-[#0c7b93]" />
        </div>

        {/* Internal / External toggle */}
        <div className="flex gap-2">
          <button type="button" onClick={()=>setType("internal")}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${type==="internal"?"bg-[#085C52] text-white border-[#085C52]":"bg-white text-slate-500 border-slate-200"}`}>
            Internal (same site)
          </button>
          <button type="button" onClick={()=>setType("external")}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${type==="external"?"bg-[#085C52] text-white border-[#085C52]":"bg-white text-slate-500 border-slate-200"}`}>
            External (new tab)
          </button>
        </div>

        {/* URL */}
        <div>
          <label style={{ fontSize:10,color:"#6B7280",fontWeight:600,display:"block",marginBottom:3 }}>
            {type==="internal" ? "Page path" : "Full URL"}
          </label>
          <input value={url} onChange={(e)=>setUrl(e.target.value)}
            placeholder={type==="internal" ? "/tours" : "https://"}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:border-[#0c7b93]" />
          {type==="internal" && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {internalPaths.map((p) => (
                <button key={p} type="button" onClick={()=>setUrl(p)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] hover:bg-[#9FE1CB]">
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Occurrence */}
        <div>
          <label style={{ fontSize:10,color:"#6B7280",fontWeight:600,display:"block",marginBottom:3 }}>Which occurrence to link?</label>
          <div className="flex gap-2">
            {(["first","second","all"] as const).map((o) => (
              <button key={o} type="button" onClick={()=>setOccurrence(o)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border capitalize transition-all ${occurrence===o?"bg-[#0c7b93] text-white border-[#0c7b93]":"bg-white text-slate-500 border-slate-200"}`}>
                {o}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={add} disabled={!phrase.trim()||!url.trim()||links.length>=8}
          className="w-full py-2 rounded-lg text-[12px] font-semibold text-white bg-[#085C52] hover:bg-[#0c7b93] disabled:opacity-40 transition-colors">
          + Add link rule ({links.length}/8)
        </button>
      </div>

      {/* Existing rules */}
      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((l, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white p-2.5">
              {l.type==="internal" ? <Link className="w-3.5 h-3.5 text-[#085C52] shrink-0" /> : <ExternalLink className="w-3.5 h-3.5 text-[#0c7b93] shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-800 truncate">"{l.phrase}"</p>
                <p className="text-[10px] text-slate-400 truncate">{l.url} · {l.occurrence} occurrence · {l.type}</p>
              </div>
              <button type="button" onClick={()=>onChange(links.filter((_,j)=>j!==i))}
                className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Layout style picker ───────────────────────────────────────────────────────
function LayoutStylePicker({ value, onChange }: { value: LayoutStyle; onChange: (v: LayoutStyle) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {LAYOUT_STYLES.map((s) => (
        <button key={s.key} type="button" onClick={()=>onChange(s.key)}
          className={`rounded-xl border p-3 text-left transition-all ${value===s.key?"border-[#0c7b93] bg-[#E0F7F4]":"border-slate-200 bg-white hover:border-[#0c7b93]"}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[16px]">{s.icon}</span>
            <span className={`text-[12px] font-bold ${value===s.key?"text-[#085C52]":"text-slate-700"}`}>{s.label}</span>
            {value===s.key && <span className="ml-auto text-[9px] font-bold text-[#0c7b93] bg-[#E0F7F4] px-1.5 py-0.5 rounded-full border border-[#0c7b93]/20">Selected</span>}
          </div>
          <p className={`text-[10px] ${value===s.key?"text-[#085C52]/70":"text-slate-400"}`}>{s.desc}</p>
        </button>
      ))}
    </div>
  );
}

// ── Generate full content button ──────────────────────────────────────────────
function GenerateFullContentButton({ title, description, category, autoLinks, layoutStyle, onDone }: {
  title:string; description:string; category:string;
  autoLinks: AutoLink[]; layoutStyle: LayoutStyle;
  onDone:(html:string)=>void;
}) {
  const [state, setState] = useState<"idle"|"loading"|"done"|"error">("idle");
  async function generate() {
    if (!title.trim()) { alert("Add a title first!"); return; }
    setState("loading");
    try {
      const res  = await fetch("/api/admin/attractions/generate-seo", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ title, description, category, mode:"full", autoLinks, layoutStyle }),
      });
      const data = await res.json();
      if (!res.ok||data.error) { setState("error"); setTimeout(()=>setState("idle"),5000); return; }
      if (data.fullDescription) { onDone(data.fullDescription); setState("done"); setTimeout(()=>setState("idle"),3000); }
    } catch { setState("error"); setTimeout(()=>setState("idle"),5000); }
  }
  return (
    <button type="button" onClick={generate} disabled={state==="loading"}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${
        state==="done"    ? "bg-green-50 text-green-700 border-green-200" :
        state==="error"   ? "bg-red-50 text-red-600 border-red-200" :
        state==="loading" ? "bg-blue-50 text-blue-600 border-blue-200" :
        "bg-[#E0F7F4] text-[#085C52] border-[#9FE1CB] hover:bg-[#9FE1CB]"
      } disabled:opacity-50`}>
      {state==="loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
       state==="done"    ? <Check   className="w-3.5 h-3.5" /> :
                           <Sparkles className="w-3.5 h-3.5" />}
      {state==="loading" ? "Writing..." : state==="done" ? "Done!" : "Generate full content"}
    </button>
  );
}

function AiSeoButton({ title, description, category, onDone }: {
  title:string; description:string; category:string;
  onDone:(tags:string[],metaDesc:string)=>void;
}) {
  const [state,  setState]  = useState<"idle"|"loading"|"done"|"error">("idle");
  const [errMsg, setErrMsg] = useState("");
  async function generate() {
    if (!title.trim()) { alert("Add a title first!"); return; }
    setState("loading"); setErrMsg("");
    try {
      const res  = await fetch("/api/admin/attractions/generate-seo", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ title, description, category, mode:"seo" }),
      });
      const data = await res.json();
      if (!res.ok||data.error) { setErrMsg(getAiErrorMessage(data)); setState("error"); setTimeout(()=>setState("idle"),8000); return; }
      if (data.tags) { onDone(data.tags, data.description ?? ""); setState("done"); setTimeout(()=>setState("idle"),3000); }
    } catch { setErrMsg("Network error."); setState("error"); setTimeout(()=>setState("idle"),5000); }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={generate} disabled={state==="loading"}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${
          state==="done"  ? "bg-green-50 text-green-700 border-green-200" :
          state==="error" ? "bg-red-50 text-red-600 border-red-200" :
          "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
        } disabled:opacity-50`}>
        {state==="loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : state==="done" ? <Check className="w-3.5 h-3.5" /> : state==="error" ? <span>✕</span> : <Sparkles className="w-3.5 h-3.5" />}
        {state==="done" ? "Generated!" : state==="loading" ? "Generating…" : state==="error" ? "Failed" : "Auto-generate SEO"}
      </button>
      {state==="error" && errMsg && <p className="text-[11px] text-red-500 max-w-xs text-right">{errMsg}</p>}
    </div>
  );
}

function EnhanceDescriptionButton({ title, description, category, autoLinks, onDone }: {
  title:string; description:string; category:string; autoLinks:AutoLink[]; onDone:(v:string)=>void;
}) {
  const [state,  setState]  = useState<"idle"|"loading"|"done"|"error">("idle");
  const [errMsg, setErrMsg] = useState("");
  async function enhance() {
    if (!title.trim()) { alert("Add a title first!"); return; }
    setState("loading"); setErrMsg("");
    try {
      const res  = await fetch("/api/admin/attractions/generate-seo", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ title, description, category, mode:"enhance", autoLinks, enableLinks:true }),
      });
      const data = await res.json();
      if (!res.ok||data.error) { setErrMsg(getAiErrorMessage(data)); setState("error"); setTimeout(()=>setState("idle"),8000); return; }
      if (data.description) { onDone(data.description); setState("done"); setTimeout(()=>setState("idle"),3000); }
    } catch { setErrMsg("Network error."); setState("error"); setTimeout(()=>setState("idle"),5000); }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={enhance} disabled={state==="loading"}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${
          state==="done"  ? "bg-green-50 text-green-700 border-green-200" :
          state==="error" ? "bg-red-50 text-red-600 border-red-200" :
          "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
        } disabled:opacity-50`}>
        {state==="loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : state==="done" ? <Check className="w-3.5 h-3.5" /> : state==="error" ? <span>✕</span> : <Wand2 className="w-3.5 h-3.5" />}
        {state==="done" ? "Rewritten!" : state==="loading" ? "Rewriting…" : state==="error" ? "Failed" : "✨ Rewrite"}
      </button>
      {state==="error" && errMsg && <p className="text-[11px] text-red-500 max-w-xs text-right">{errMsg}</p>}
    </div>
  );
}

// ── Form panel ────────────────────────────────────────────────────────────────
function AttractionFormPanel({ item, onSave, onDelete, onCancel }: {
  item?: Attraction | null;
  onSave:    (f: AttractionForm & { hero_position:string; photos:Photo[]; meta_description:string; description_html:string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel:  () => void;
}) {
  const [form, setForm] = useState<AttractionForm>(
    item ? {
      title:          item.title,
      slug:           item.slug,
      description:    item.description    ?? "",
      image_url:      item.image_url      ?? "",
      image_alt:      "",
      category:       (item.category      ?? "attractions") as AttractionForm["category"],
      cover_gradient: item.cover_gradient ?? GRADIENTS[0].value,
      cover_emoji:    item.cover_emoji    ?? "🌴",
      is_live:        item.is_live,
      is_featured:    item.is_featured,
      is_published:   item.is_published,
      read_minutes:   item.read_minutes   ?? 2,
      seo_tags:       item.seo_tags       ?? [],
      type:           item.type           ?? "attraction",
      sort_order:     item.sort_order     ?? 0,
      layout_style:   (item.layout_style  ?? "standard") as LayoutStyle,
      auto_links:     (item.auto_links    ?? []) as AutoLink[],
    } : EMPTY_FORM
  );
  const [photos,          setPhotos]          = useState<Photo[]>(
    (item as any)?.photos?.length ? (item as any).photos : item?.image_url ? [{ url:item.image_url, alt:item.title }] : []
  );
  const [heroPosition,    setHeroPosition]    = useState<string>((item as any)?.hero_position ?? "center center");
  const [metaDescription, setMetaDescription] = useState<string>((item as any)?.meta_description ?? "");
  const [descriptionHtml, setDescriptionHtml] = useState<string>((item as any)?.description_html ?? "");
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const wordCount = descriptionHtml.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

  function set<K extends keyof AttractionForm>(k: K, v: AttractionForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handlePhotosChange(p: Photo[]) {
    setPhotos(p);
    set("image_url", p[0]?.url ?? "");
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    // Strip HTML tags to get plain text description for word count / fallback
    const plainText = descriptionHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    try { await onSave({ ...form, hero_position:heroPosition, photos, meta_description:metaDescription, description_html:descriptionHtml, description: plainText }); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("Delete this attraction? This cannot be undone.")) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  }

  const input = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-white focus:outline-none focus:border-[#0c7b93] transition-colors";
  const lbl   = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";
  const card  = "rounded-2xl border border-slate-100 bg-white p-5 space-y-4";

  const liveHealth = getSeoHealth({
    ...form,
    id: (item as any)?.id ?? "",
    created_at: (item as any)?.created_at ?? "",
    updated_at: (item as any)?.updated_at ?? "",
    image_url: photos[0]?.url ?? form.image_url,
    meta_description: metaDescription,
    description: descriptionHtml.replace(/<[^>]+>/g," "),
  } as any);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-[20px] font-semibold text-slate-900">{item ? "Edit attraction" : "Add attraction"}</h1>
            {item && <SeoBadge health={liveHealth} />}
          </div>
          <p className="text-[13px] text-slate-400">Shows on the public Explore & Discover page.</p>
        </div>
        <button onClick={onCancel} className="flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* SEO health checklist */}
      {item && (
        <div className={`rounded-xl border p-3 ${liveHealth.status==="good"?"border-green-200 bg-green-50":liveHealth.status==="warn"?"border-amber-200 bg-amber-50":"border-red-200 bg-red-50"}`}>
          <p style={{ fontSize:11,fontWeight:700,marginBottom:6,color:liveHealth.status==="good"?"#166534":liveHealth.status==="warn"?"#854D0E":"#991B1B" }}>
            SEO health — {liveHealth.score}%
          </p>
          <div className="flex flex-wrap gap-1.5">
            {liveHealth.passed.map((p) => (
              <span key={p} style={{ display:"inline-flex",alignItems:"center",gap:3,fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:999,background:"#DCFCE7",color:"#166534",border:"1px solid #BBF7D0" }}>
                <Check className="w-2.5 h-2.5" />{p}
              </span>
            ))}
            {liveHealth.missing.map((m) => (
              <span key={m} style={{ display:"inline-flex",alignItems:"center",gap:3,fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:999,background:"#FEE2E2",color:"#991B1B",border:"1px solid #FCA5A5" }}>
                <AlertCircle className="w-2.5 h-2.5" />{m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content card */}
      <div className={card}>
        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /><h2 className="text-[14px] font-semibold text-slate-700">Content</h2></div>
        <div>
          <label className={lbl}>Title *</label>
          <input className={input} value={form.title}
            onChange={(e)=>{ set("title",e.target.value); if(!item) set("slug",slugify(e.target.value)); }}
            placeholder="e.g. Cloud 9 Surf Break" />
        </div>

        {/* Description with RichDescriptionEditor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={lbl} style={{ marginBottom:0 }}>
              <div className="flex items-center gap-1.5"><AlignLeft className="w-3 h-3" /> Full description (shown on page)</div>
            </label>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className={`text-[10px] font-semibold ${wordCount>=80?"text-green-600":"text-amber-500"}`}>
                {wordCount} words {wordCount>=80?"✓":"(need 80+)"}
              </span>
              <GenerateFullContentButton
                title={form.title}
                description={descriptionHtml.replace(/<[^>]+>/g," ")}
                category={form.category}
                autoLinks={form.auto_links}
                layoutStyle={form.layout_style}
                onDone={(html)=>setDescriptionHtml(html)}
              />
              <EnhanceDescriptionButton
                title={form.title}
                description={descriptionHtml.replace(/<[^>]+>/g," ")}
                category={form.category}
                autoLinks={form.auto_links}
                onDone={(v)=>setDescriptionHtml(v)}
              />
            </div>
          </div>
          <RichDescriptionEditor
            value={descriptionHtml}
            onChange={setDescriptionHtml}
            placeholder="Write rough notes and hit 'Generate full content' — or type directly and use the toolbar to add bold, italic, and links."
          />
          <p className="text-[10px] text-slate-400 mt-1">
            💡 Type notes → <strong>Generate full content</strong> writes 500+ words with H2 sections and auto-injects your link rules. <strong>Rewrite</strong> polishes existing text.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Type</label>
            <select className={input} value={form.type} onChange={(e)=>set("type",e.target.value as AttractionForm["type"])}>
              <option value="attraction">Attraction / place</option>
              <option value="news">News / story</option>
              <option value="video">Video</option>
              <option value="tip">Travel tip</option>
              <option value="partner">Partner / sponsored</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Category</label>
            <select className={input} value={form.category} onChange={(e)=>set("category",e.target.value as AttractionForm["category"])}>
              {CATEGORIES.filter((c)=>c.key!=="all").map((c)=>(
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}><div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Read time (minutes)</div></label>
            <input type="number" min={1} max={30} className={input} value={form.read_minutes} onChange={(e)=>set("read_minutes",Number(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Emoji fallback</label>
            <input className={input} value={form.cover_emoji} onChange={(e)=>set("cover_emoji",e.target.value)} placeholder="🌴" />
          </div>
        </div>
        <div>
          <label className={lbl}>Gradient (shown if no photo)</label>
          <div className="grid grid-cols-7 gap-2">
            {GRADIENTS.map((g)=>(
              <button key={g.value} type="button" onClick={()=>set("cover_gradient",g.value)}
                className={`h-9 rounded-lg bg-gradient-to-br ${g.value} transition-all ${form.cover_gradient===g.value?"ring-2 ring-[#0c7b93] ring-offset-1":"opacity-60 hover:opacity-100"}`}
                title={g.label} />
            ))}
          </div>
        </div>
        <div className="flex gap-6 pt-1">
          {(["is_featured","is_live","is_published"] as const).map((key)=>(
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`w-9 h-5 rounded-full transition-colors relative ${form[key]?"bg-[#085C52]":"bg-slate-200"}`} onClick={()=>set(key,!form[key])}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form[key]?"translate-x-4":"translate-x-0.5"}`} />
              </div>
              <span className="text-[13px] text-slate-600 capitalize">{key.replace("is_","")}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Layout style card */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[16px]">▦</span>
          <h2 className="text-[14px] font-semibold text-slate-700">Page layout</h2>
        </div>
        <p className="text-[11px] text-slate-400 -mt-2">Controls how the content looks on the public attraction page.</p>
        <LayoutStylePicker value={form.layout_style} onChange={(v)=>set("layout_style",v)} />
      </div>

      {/* Auto-link rules card */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-slate-400" />
          <h2 className="text-[14px] font-semibold text-slate-700">Auto-link rules</h2>
        </div>
        <p className="text-[11px] text-slate-400 -mt-2">
          Set phrases that get automatically linked when content is generated. Min 2, max 8. Applied on "Generate full content" and "Rewrite".
        </p>
        <AutoLinkManager links={form.auto_links} onChange={(l)=>set("auto_links",l)} />
      </div>

      {/* Photos card */}
      <div className={card}>
        <div className="flex items-center gap-2"><ImageIcon className="w-4 h-4 text-slate-400" /><h2 className="text-[14px] font-semibold text-slate-700">Photos</h2></div>
        <MultiPhotoUpload photos={photos} title={form.title} category={form.category} onChange={handlePhotosChange} />
        {photos.length > 0 && (
          <div>
            <label className={lbl}><div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Hero crop position</div></label>
            <p className="text-[11px] text-slate-400 mb-2">Click a position — preview updates live.</p>
            <HeroPositionPicker value={heroPosition} onChange={setHeroPosition} imageUrl={photos[0]?.url} />
          </div>
        )}
      </div>

      {/* SEO card */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-slate-400" /><h2 className="text-[14px] font-semibold text-slate-700">SEO</h2></div>
          <AiSeoButton title={form.title} description={descriptionHtml.replace(/<[^>]+>/g," ")} category={form.category}
            onDone={(tags,metaDesc)=>{
              set("seo_tags", Array.from(new Set([...form.seo_tags,...tags])));
              if (metaDesc) setMetaDescription(metaDesc.slice(0,160));
            }} />
        </div>
        <div>
          <label className={lbl}>URL slug</label>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-400 whitespace-nowrap shrink-0">travelasiargao.com/attractions/</span>
            <input className={input} value={form.slug} onChange={(e)=>set("slug",slugify(e.target.value))} placeholder="auto-generated from title" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={lbl} style={{ marginBottom:0 }}>Google meta description</label>
            <span className={`text-[10px] font-semibold ${metaDescription.length>160?"text-red-500":metaDescription.length>0?"text-green-600":"text-slate-400"}`}>
              {metaDescription.length}/160 {metaDescription.length>0&&metaDescription.length<=160?"✓":""}
            </span>
          </div>
          <textarea className={input+" resize-none"} rows={3} maxLength={160} value={metaDescription}
            onChange={(e)=>setMetaDescription(e.target.value)}
            placeholder="Short summary for Google search results. Max 160 chars." />
        </div>
        <div>
          <label className={lbl}><div className="flex items-center gap-1.5"><Tag className="w-3 h-3" /> SEO keyword tags</div></label>
          <p className="text-[11px] text-slate-400 mb-2">3–6 phrases tourists search on Google.</p>
          <TagInput tags={form.seo_tags} onChange={(t)=>set("seo_tags",t)} />
        </div>
        <SeoPreview title={form.title} metaDescription={metaDescription} slug={form.slug} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {item && onDelete && (
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50">
            <Trash2 className="w-4 h-4" /> {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">
          <ArrowLeft className="w-4 h-4" /> Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving||!form.title}
          className="ml-auto flex items-center gap-1.5 px-6 py-2.5 text-[13px] font-semibold text-white bg-[#085C52] rounded-xl hover:bg-[#0c7b93] disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : item ? "Save changes" : "Add attraction"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AttractionsAdminPage({ initialItems }: { initialItems: Attraction[] }) {
  const [tab,     setTab]     = useState<"attractions"|"ads">("attractions");
  const [items,   setItems]   = useState<Attraction[]>(initialItems);
  const [editing, setEditing] = useState<Attraction|null|"new">(null);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState<"all"|"good"|"warn"|"poor">("all");

  const filtered = items
    .filter((i)=>!search.trim()||i.title.toLowerCase().includes(search.toLowerCase()))
    .filter((i)=>filter==="all"||getSeoHealth(i).status===filter);

  async function handleSave(form: AttractionForm & { hero_position:string; photos:Photo[]; meta_description:string; description_html:string }) {
    const body = {
      ...(editing&&editing!=="new" ? { id:(editing as Attraction).id } : {}),
      title:form.title, slug:form.slug, description:form.description,
      description_html:form.description_html, meta_description:form.meta_description,
      image_url:form.image_url||null, sort_order:form.sort_order,
      is_published:form.is_published, category:form.category,
      cover_gradient:form.cover_gradient, cover_emoji:form.cover_emoji,
      is_live:form.is_live, is_featured:form.is_featured,
      read_minutes:form.read_minutes, seo_tags:form.seo_tags,
      type:form.type, hero_position:form.hero_position, photos:form.photos,
      layout_style:form.layout_style, auto_links:form.auto_links,
    };
    const res  = await fetch("/api/admin/attractions/save", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    const data = await res.json();
    if (data.id) {
      if (editing==="new") {
        setItems((prev)=>[{ ...body, id:data.id, created_at:new Date().toISOString(), updated_at:new Date().toISOString() } as Attraction,...prev]);
      } else {
        setItems((prev)=>prev.map((i)=>i.id===data.id ? { ...i,...body } as Attraction : i));
      }
      setEditing(null);
    } else { alert("Save failed — check the console."); }
  }

  async function handleDelete() {
    if (!editing||editing==="new") return;
    const res = await fetch("/api/admin/attractions/delete", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id:(editing as Attraction).id }) });
    if (res.ok) { setItems((prev)=>prev.filter((i)=>i.id!==(editing as Attraction).id)); setEditing(null); }
  }

  if (editing !== null) {
    return <AttractionFormPanel item={editing==="new"?null:editing} onSave={handleSave} onDelete={editing!=="new"?handleDelete:undefined} onCancel={()=>setEditing(null)} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <DashboardHeader items={items} />
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
        <button onClick={()=>setTab("attractions")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-all ${tab==="attractions"?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
          <MapPin className="w-4 h-4" /> Attractions
        </button>
        <button onClick={()=>setTab("ads")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-all ${tab==="ads"?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
          <Sparkles className="w-4 h-4" /> Ad slots
        </button>
      </div>

      {tab==="attractions" && (
        <>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search attractions…"
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-[#0c7b93] bg-white" />
            </div>
            <select value={filter} onChange={(e)=>setFilter(e.target.value as any)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-white focus:outline-none focus:border-[#0c7b93] text-slate-600">
              <option value="all">All SEO</option>
              <option value="good">✓ Ready</option>
              <option value="warn">⚠ Needs work</option>
              <option value="poor">✕ Missing SEO</option>
            </select>
            <button onClick={()=>setEditing("new")}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#085C52] text-white text-[13px] font-semibold rounded-xl hover:bg-[#0c7b93] whitespace-nowrap">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {filtered.length===0 && <div className="py-12 text-center text-slate-400 text-[13px]">No attractions found.</div>}
            {filtered.map((item)=>{
              const health = getSeoHealth(item);
              return (
                <div key={item.id} onClick={()=>setEditing(item)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-[#0c7b93] cursor-pointer transition-colors group">
                  <div className={`w-14 h-10 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br ${item.cover_gradient??"from-[#085C52] to-[#0c7b93]"} flex items-center justify-center text-lg`}>
                    {item.image_url ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" /> : item.cover_emoji??"🌴"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{item.title}</p>
                      {item.is_featured && <span className="shrink-0 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-semibold">Featured</span>}
                      {item.is_live     && <span className="shrink-0 text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">Live</span>}
                      {!item.is_published && <span className="shrink-0 text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-semibold">Draft</span>}
                      {item.layout_style && item.layout_style!=="standard" && (
                        <span className="shrink-0 text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold capitalize">{item.layout_style}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] text-slate-400 capitalize">{item.type} · {item.category??"–"}</p>
                      <SeoBadge health={health} />
                    </div>
                    {health.missing.length>0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">Missing: {health.missing.join(" · ")}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-center gap-0.5 mr-1">
                    <div style={{ width:32,height:32,borderRadius:"50%",background:`conic-gradient(${health.status==="good"?"#22C55E":health.status==="warn"?"#EAB308":"#EF4444"} ${health.score*3.6}deg,#F1F5F9 0deg)`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <div style={{ width:22,height:22,borderRadius:"50%",background:"white",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <span style={{ fontSize:8,fontWeight:800,color:health.status==="good"?"#166534":health.status==="warn"?"#854D0E":"#991B1B" }}>{health.score}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0c7b93] shrink-0" />
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab==="ads" && <AdsAdminPage initialAds={[]} />}
    </div>
  );
}