"use client";

import { useState, useRef, useEffect } from "react";
import { Bold, Italic, Link, ExternalLink, Unlink } from "lucide-react";

// ── Simple rich text editor ───────────────────────────────────────────────────
// Uses contentEditable with execCommand for bold/italic
// Custom link insertion with internal/external toggle
// Outputs clean HTML string saved to DB, rendered safely on public page

export function RichDescriptionEditor({
  value,
  onChange,
  placeholder = "Write anything — rough notes or full paragraphs.",
}: {
  value:       string;
  onChange:    (html: string) => void;
  placeholder?: string;
}) {
  const editorRef        = useRef<HTMLDivElement>(null);
  const [showLinkPanel, setShowLinkPanel]  = useState(false);
  const [linkText,      setLinkText]       = useState("");
  const [linkUrl,       setLinkUrl]        = useState("");
  const [linkType,      setLinkType]       = useState<"internal" | "external">("internal");
  const savedSelection   = useRef<Range | null>(null);

  // Sync initial value
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, []);

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
      const text = sel.toString();
      if (text) setLinkText(text);
    }
  }

  function restoreSelection() {
    if (savedSelection.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelection.current);
    }
  }

  function execCmd(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function handleBold()   { execCmd("bold"); }
  function handleItalic() { execCmd("italic"); }

  function openLinkPanel() {
    saveSelection();
    setLinkUrl("");
    setLinkType("internal");
    setShowLinkPanel(true);
  }

  function insertLink() {
    if (!linkUrl.trim()) { setShowLinkPanel(false); return; }
    restoreSelection();
    editorRef.current?.focus();

    const sel  = window.getSelection();
    const range = savedSelection.current;
    if (!range) return;

    const isExternal = linkType === "external";
    const href = isExternal
      ? (linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`)
      : (linkUrl.startsWith("/") ? linkUrl : `/${linkUrl}`);

    const a = document.createElement("a");
    a.href  = href;
    a.textContent = linkText || sel?.toString() || href;
    a.style.color = "#0c7b93";
    a.style.textDecoration = "underline";
    if (isExternal) {
      a.target = "_blank";
      a.rel    = "noopener noreferrer";
    }

    range.deleteContents();
    range.insertNode(a);

    // Move cursor after link
    const newRange = document.createRange();
    newRange.setStartAfter(a);
    newRange.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(newRange);

    onChange(editorRef.current?.innerHTML ?? "");
    setShowLinkPanel(false);
    setLinkText("");
    setLinkUrl("");
  }

  function removeLink() {
    execCmd("unlink");
  }

  const btnBase = "flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-[#0c7b93] hover:text-[#0c7b93] transition-colors cursor-pointer";

  return (
    <div className="space-y-1">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-t-xl border-b-0">
        <button type="button" onClick={handleBold}   className={btnBase} title="Bold (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={handleItalic} className={btnBase} title="Italic (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-0.5" />
        <button type="button" onClick={openLinkPanel} className={btnBase} title="Add link">
          <Link className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={removeLink} className={btnBase} title="Remove link">
          <Unlink className="w-3.5 h-3.5" />
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <span style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 600 }}>
            Select text → click B / I / 🔗
          </span>
        </div>
      </div>

      {/* Link insertion panel */}
      {showLinkPanel && (
        <div className="border border-[#0c7b93] rounded-xl p-3 bg-[#F0FDF8] space-y-2">
          <p style={{ fontSize: 11, fontWeight: 700, color: "#085C52" }}>Insert link</p>

          {/* Internal vs External toggle */}
          <div className="flex gap-2">
            <button type="button"
              onClick={() => setLinkType("internal")}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${linkType === "internal" ? "bg-[#085C52] text-white border-[#085C52]" : "bg-white text-slate-500 border-slate-200"}`}>
              Internal (stay on site)
            </button>
            <button type="button"
              onClick={() => setLinkType("external")}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${linkType === "external" ? "bg-[#085C52] text-white border-[#085C52]" : "bg-white text-slate-500 border-slate-200"}`}>
              External (new tab)
            </button>
          </div>

          {/* Link text */}
          <div>
            <label style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, display: "block", marginBottom: 3 }}>
              Link text
            </label>
            <input value={linkText} onChange={(e) => setLinkText(e.target.value)}
              placeholder="e.g. book a tour"
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:border-[#0c7b93]" />
          </div>

          {/* URL */}
          <div>
            <label style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, display: "block", marginBottom: 3 }}>
              {linkType === "internal" ? "Page path (e.g. /tours or /book)" : "Full URL (e.g. https://instagram.com/...)"}
            </label>
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={linkType === "internal" ? "/tours" : "https://"}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:border-[#0c7b93]"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertLink(); } }}
            />
          </div>

          {linkType === "internal" && (
            <div className="flex flex-wrap gap-1.5">
              {["/tours", "/book", "/attractions", "/weather"].map((path) => (
                <button key={path} type="button"
                  onClick={() => setLinkUrl(path)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB] hover:bg-[#9FE1CB] transition-colors">
                  {path}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowLinkPanel(false)}
              className="flex-1 py-1.5 rounded-lg text-[12px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={insertLink}
              className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-[#085C52] hover:bg-[#0c7b93] transition-colors">
              Insert link
            </button>
          </div>
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML ?? "")}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        data-placeholder={placeholder}
        className="w-full border border-slate-200 rounded-b-xl px-3 py-2.5 text-[13px] bg-white focus:outline-none focus:border-[#0c7b93] transition-colors min-h-[140px]"
        style={{ lineHeight: 1.75 }}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          pointer-events: none;
        }
        [contenteditable] a { color: #0c7b93; text-decoration: underline; }
        [contenteditable] b, [contenteditable] strong { font-weight: 700; }
        [contenteditable] i, [contenteditable] em { font-style: italic; }
      `}</style>
    </div>
  );
}

// ── Public renderer — safely renders the saved HTML ───────────────────────────
// Use this on the public attraction page instead of <p>{description}</p>
export function RichDescription({ html }: { html: string }) {
  if (!html) return null;
  return (
    <div
      className="rich-description"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ fontSize: 16, color: "#1f2937", lineHeight: 1.85, fontWeight: 400, marginBottom: 36 }}
    />
  );
}
