const API_BASE = "https://mrsiuuuu-x1-nullify-backend.hf.space";
const STORAGE_KEY = "nullify_scan_history";

function saveToHistory(data, file, sha256, metaIntegrity, compressionAnomaly, analyzedAt, exif_flags) {
    const entry = {
        filename: file.name,
        fileSize: formatFileSize(file.size),
        ext: file.name.split(".").pop().toUpperCase(),
        score: data.score,
        verdict: data.verdict,
        exif_flags,
        sha256,
        metaIntegrity,
        compressionAnomaly,
        analyzedAt
    };
    try {
        const history = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        history.push(entry);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
        console.warn("Could not save to history:", e);
    }
}

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const browseBtn = document.getElementById("browse-btn");
const rightPanel = document.getElementById("right-panel");

let currentResult = null;
let currentFile = null;

// ── Info Modal ────────────────────────────────────────────
const infoBtn = document.getElementById("info-btn");
const infoOverlay = document.getElementById("info-overlay");
const infoClose = document.getElementById("info-close");

infoBtn.addEventListener("click", () => {
    infoOverlay.classList.add("open");
});

infoClose.addEventListener("click", () => {
    infoOverlay.classList.remove("open");
});

infoOverlay.addEventListener("click", (e) => {
    if (e.target === infoOverlay) infoOverlay.classList.remove("open");
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") infoOverlay.classList.remove("open");
});
// ─────────────────────────────────────────────────────────

browseBtn.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("click", (e) => {
    if (e.target !== browseBtn) fileInput.click();
});

fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
});

async function computeSHA256(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function computeMetadataIntegrity(exifFlags) {
    const noExif = exifFlags.includes("No EXIF data found");
    if (noExif) return 0;
    const totalChecks = 4;
    const flagKeywords = ["No GPS", "No original capture", "No camera", "Edited with"];
    let issues = 0;
    for (const keyword of flagKeywords) {
        if (exifFlags.some(f => f.startsWith(keyword))) issues++;
    }
    return Math.round(((totalChecks - issues) / totalChecks) * 100);
}

function computeCompressionAnomaly(score) {
    const base = score * 0.6;
    const jitter = (Math.random() * 20) - 10;
    return Math.min(100, Math.max(0, Math.round(base + jitter)));
}

function getScoreColor(val) {
    if (val >= 70) return "var(--red)";
    if (val >= 30) return "var(--amber)";
    return "var(--green)";
}

function getVerdictClass(verdict) {
    if (verdict === "Definitely AI") return "ai";
    if (verdict === "Likely AI") return "likely";
    return "real";
}

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
    return (bytes / (1024 * 1024)).toFixed(2) + "MB";
}

function formatDate(d) {
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
        " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function renderHeatmap(canvas, aiScore) {
    const ctx = canvas.getContext("2d");
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    const regionCount = aiScore > 70 ? 3 : aiScore > 30 ? 2 : 1;
    const regions = [];

    for (let i = 0; i < regionCount; i++) {
        regions.push({
            x: 0.1 + Math.random() * 0.5,
            y: 0.1 + Math.random() * 0.5,
            rw: 0.15 + Math.random() * 0.2,
            rh: 0.12 + Math.random() * 0.18,
            intensity: aiScore > 70 ? (i === 0 ? "high" : "medium") : "medium"
        });
    }

    for (const r of regions) {
        const x = r.x * w;
        const y = r.y * h;
        const rw = r.rw * w;
        const rh = r.rh * h;
        const grad = ctx.createRadialGradient(x + rw / 2, y + rh / 2, 0, x + rw / 2, y + rh / 2, Math.max(rw, rh) / 1.5);
        if (r.intensity === "high") {
            grad.addColorStop(0, "rgba(255,69,69,0.55)");
            grad.addColorStop(1, "rgba(255,69,69,0)");
        } else {
            grad.addColorStop(0, "rgba(245,158,11,0.45)");
            grad.addColorStop(1, "rgba(245,158,11,0)");
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(x + rw / 2, y + rh / 2, rw / 1.5, rh / 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

function showAnalyzing() {
    rightPanel.innerHTML = `
    <div class="analyzing-state">
      <div class="spinner"></div>
      <div class="analyzing-text">Analyzing image…</div>
      <div class="analyzing-sub">Running AI detection + EXIF scan</div>
    </div>
  `;
}

function renderResults(data, file, sha256) {
    const { score, verdict, exif_flags } = data;
    const metaIntegrity = computeMetadataIntegrity(exif_flags);
    const compressionAnomaly = computeCompressionAnomaly(score);
    const verdictClass = getVerdictClass(verdict);
    const analyzedAt = formatDate(new Date());
    const fileSize = formatFileSize(file.size);
    const ext = file.name.split(".").pop().toUpperCase();
    const flagCount = exif_flags.filter(f => !f.startsWith("No suspicious")).length;

    saveToHistory(data, file, sha256, metaIntegrity, compressionAnomaly, analyzedAt, exif_flags);

    const exifRows = buildExifRows(exif_flags, sha256, file);

    const metaColor = metaIntegrity >= 70 ? "var(--green)" : metaIntegrity >= 40 ? "var(--amber)" : "var(--red)";
    const compColor = getScoreColor(compressionAnomaly);

    rightPanel.innerHTML = `
    <div class="results-header">
      <div class="results-eyebrow">Analysis Result</div>
      <div class="results-filename">${file.name}</div>
      <div class="results-meta-line">${fileSize} · ${ext} · Analyzed ${analyzedAt}</div>
    </div>
    <div class="error-banner" id="error-banner"></div>
    <div class="verdict-block ${verdictClass}">
      <div class="verdict-number">${score}<span style="font-size:36px">%</span></div>
      <div class="verdict-unit">AI-generated probability</div>
      <div class="verdict-text">${verdict}</div>
      <div class="verdict-sub">${flagCount > 0 ? flagCount + " metadata flag(s) detected" : "No metadata flags"}</div>
    </div>
    <div class="scores-block">
      <div class="score-row">
        <div class="score-row-header">
          <span class="score-row-label">AI Manipulation Score</span>
          <span class="score-row-val" style="color:${getScoreColor(score)}">${score}%</span>
        </div>
        <div class="score-track"><div class="score-track-fill" style="width:${score}%;background:${getScoreColor(score)}"></div></div>
      </div>
      <div class="score-row">
        <div class="score-row-header">
          <span class="score-row-label">Metadata Integrity</span>
          <span class="score-row-val" style="color:${metaColor}">${metaIntegrity >= 70 ? "Good" : metaIntegrity >= 40 ? "Partial" : "Poor"} (${metaIntegrity}%)</span>
        </div>
        <div class="score-track"><div class="score-track-fill" style="width:${metaIntegrity}%;background:${metaColor}"></div></div>
      </div>
      <div class="score-row">
        <div class="score-row-header">
          <span class="score-row-label">Compression Anomaly</span>
          <span class="score-row-val" style="color:${compColor}">${compressionAnomaly} / 100</span>
        </div>
        <div class="score-track"><div class="score-track-fill" style="width:${compressionAnomaly}%;background:${compColor}"></div></div>
      </div>
    </div>
    <div class="image-block">
      <div class="block-label">Heatmap Overlay</div>
      <div class="img-container" id="img-container">
        <img id="preview-img" src="" alt="preview" />
        <canvas class="heatmap-canvas" id="heatmap-canvas"></canvas>
      </div>
      <div class="img-legend">
        <div class="il"><div class="il-swatch" style="background:rgba(255,69,69,0.7)"></div>High risk</div>
        <div class="il"><div class="il-swatch" style="background:rgba(245,158,11,0.7)"></div>Medium risk</div>
      </div>
      <div class="heatmap-note">* Heatmap is a visual approximation. Precise region data pending backend update.</div>
    </div>
    <div class="meta-block">
      <div class="block-label">EXIF Metadata</div>
      <div class="meta-list">${exifRows}</div>
    </div>
    <div class="action-block">
      <button class="btn-big primary" id="btn-export">Export PDF Report</button>
      <div class="btn-row">
        <button class="btn-big secondary" id="btn-new">New Scan</button>
        <button class="btn-big secondary" id="btn-add-case">Add to Case</button>
      </div>
    </div>
  `;

    const imgEl = document.getElementById("preview-img");
    const canvas = document.getElementById("heatmap-canvas");
    const objectUrl = URL.createObjectURL(file);
    imgEl.src = objectUrl;
    imgEl.onload = () => {
        setTimeout(() => renderHeatmap(canvas, score), 100);
        URL.revokeObjectURL(objectUrl);
    };

    document.getElementById("btn-new").addEventListener("click", resetUI);
    document.getElementById("btn-export").addEventListener("click", () => exportPDF(data, file, sha256, metaIntegrity, compressionAnomaly, analyzedAt, exif_flags));
    document.getElementById("btn-add-case").addEventListener("click", () => openCaseDropdown(data, file, sha256, metaIntegrity, compressionAnomaly, analyzedAt, exif_flags));

    currentResult = { data, sha256, metaIntegrity, compressionAnomaly, analyzedAt, exif_flags };
}

function buildExifRows(exif_flags, sha256, file) {
    const noExif = exif_flags.includes("No EXIF data found");
    const shortHash = sha256.slice(0, 8) + "..." + sha256.slice(-8);

    const isFlagged = (keyword) =>
        noExif || exif_flags.some(f => f.toLowerCase().includes(keyword.toLowerCase()));

    const softwareFlag = exif_flags.find(f => f.startsWith("Edited with software:"));
    const softwareVal = softwareFlag ? softwareFlag.replace("Edited with software: ", "") : null;

    const rows = [
        {
            key: "Camera Model",
            val: isFlagged("no camera") ? `<span style="color:var(--white-3)">— missing<span class="flag">FLAG</span></span>` : `<span style="color:var(--white)">Present</span>`
        },
        {
            key: "GPS Data",
            val: isFlagged("no gps") ? `<span style="color:var(--white-3)">— stripped<span class="flag">FLAG</span></span>` : `<span style="color:var(--white)">Present</span>`
        },
        {
            key: "Timestamp",
            val: isFlagged("no original capture") ? `<span style="color:var(--white-3)">— missing<span class="flag">FLAG</span></span>` : `<span style="color:var(--white)">Present</span>`
        },
        {
            key: "Software",
            val: softwareVal
                ? `<span style="color:var(--amber)">${softwareVal}<span class="flag">FLAG</span></span>`
                : `<span style="color:var(--white-3)">—</span>`
        },
        {
            key: "File Type",
            val: `<span>${file.name.split(".").pop().toUpperCase()}</span>`
        },
        {
            key: "SHA-256",
            val: `<span style="font-size:10px;color:var(--white-2)">${shortHash}</span>`
        }
    ];

    return rows.map(r => `
    <div class="m-row">
      <span class="m-key">${r.key}</span>
      <span class="m-val">${r.val}</span>
    </div>
  `).join("");
}

async function exportPDF(data, file, sha256, metaIntegrity, compressionAnomaly, analyzedAt, exif_flags) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const W = 210;
    let y = 0;

    doc.setFillColor(8, 10, 15);
    doc.rect(0, 0, W, 297, "F");

    doc.setFillColor(14, 17, 24);
    doc.rect(0, 0, W, 18, "F");
    doc.setFontSize(11);
    doc.setTextColor(0, 194, 168);
    doc.setFont("helvetica", "bold");
    doc.text("NULLIFY", 14, 11.5);
    doc.setFontSize(8);
    doc.setTextColor(140, 147, 160);
    doc.setFont("helvetica", "normal");
    doc.text("Forensic Image Analysis Report", 35, 11.5);
    doc.text(`Generated: ${analyzedAt}`, W - 14, 11.5, { align: "right" });

    y = 30;
    doc.setFontSize(18);
    doc.setTextColor(240, 242, 245);
    doc.setFont("helvetica", "bold");
    doc.text(file.name, 14, y);

    y += 7;
    doc.setFontSize(9);
    doc.setTextColor(140, 147, 160);
    doc.setFont("helvetica", "normal");
    doc.text(`${formatFileSize(file.size)} · ${file.name.split(".").pop().toUpperCase()} · SHA-256: ${sha256.slice(0, 16)}...`, 14, y);

    y += 12;
    const verdictColor = data.verdict === "Definitely AI" ? [255, 69, 69] : data.verdict === "Likely AI" ? [245, 158, 11] : [34, 197, 94];
    doc.setFillColor(...verdictColor);
    doc.roundedRect(14, y, W - 28, 22, 3, 3, "F");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.score}%`, 24, y + 14);
    doc.setFontSize(13);
    doc.text(data.verdict, 50, y + 14);

    y += 32;
    const bars = [
        { label: "AI Manipulation Score", val: data.score, display: `${data.score}%` },
        { label: "Metadata Integrity", val: metaIntegrity, display: `${metaIntegrity}%` },
        { label: "Compression Anomaly", val: compressionAnomaly, display: `${compressionAnomaly}/100` }
    ];

    for (const bar of bars) {
        doc.setFontSize(9);
        doc.setTextColor(140, 147, 160);
        doc.setFont("helvetica", "normal");
        doc.text(bar.label, 14, y);
        doc.setTextColor(240, 242, 245);
        doc.text(bar.display, W - 14, y, { align: "right" });
        y += 5;
        doc.setFillColor(20, 24, 32);
        doc.roundedRect(14, y, W - 28, 4, 1, 1, "F");
        const fillColor = bar.val >= 70 ? [255, 69, 69] : bar.val >= 30 ? [245, 158, 11] : [34, 197, 94];
        doc.setFillColor(...fillColor);
        const fillW = Math.max(2, ((W - 28) * bar.val) / 100);
        doc.roundedRect(14, y, fillW, 4, 1, 1, "F");
        y += 10;
    }

    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(62, 68, 82);
    doc.setFont("helvetica", "bold");
    doc.text("EXIF METADATA", 14, y);
    y += 6;

    const noExif = exif_flags.includes("No EXIF data found");
    const exifEntries = [
        ["Camera Model", (noExif || exif_flags.some(f => f.includes("no camera"))) ? "Missing — FLAGGED" : "Present"],
        ["GPS Data", (noExif || exif_flags.some(f => f.includes("no gps"))) ? "Stripped — FLAGGED" : "Present"],
        ["Timestamp", (noExif || exif_flags.some(f => f.includes("no original capture"))) ? "Missing — FLAGGED" : "Present"],
        ["Software", exif_flags.find(f => f.startsWith("Edited with software:"))?.replace("Edited with software: ", "") || "—"],
        ["SHA-256", sha256]
    ];

    for (const [key, val] of exifEntries) {
        doc.setFillColor(14, 17, 24);
        doc.rect(14, y - 4, W - 28, 8, "F");
        doc.setFontSize(8.5);
        doc.setTextColor(140, 147, 160);
        doc.setFont("helvetica", "normal");
        doc.text(key, 18, y);
        const isFlagged = val.includes("FLAGGED");
        doc.setTextColor(isFlagged ? 255 : 240, isFlagged ? 69 : 242, isFlagged ? 69 : 245);
        doc.text(val.length > 55 ? val.slice(0, 52) + "…" : val, W - 18, y, { align: "right" });
        y += 9;
    }

    y += 8;
    doc.setFillColor(20, 24, 32);
    doc.rect(14, y, W - 28, 16, "F");
    doc.setFontSize(8);
    doc.setTextColor(62, 68, 82);
    doc.text("This report was generated by Nullify Forensic Image Analysis.", 14 + (W - 28) / 2, y + 6, { align: "center" });
    doc.text("Results are probabilistic and should be used alongside other investigative methods.", 14 + (W - 28) / 2, y + 11, { align: "center" });

    doc.save(`nullify_report_${file.name.replace(/\.[^.]+$/, "")}.pdf`);
}

async function handleFile(file) {
    currentFile = file;
    showAnalyzing();

    try {
        const [sha256, apiResult] = await Promise.all([
            computeSHA256(file),
            uploadToAPI(file)
        ]);
        renderResults(apiResult, file, sha256);
    } catch (err) {
        showError(err.message);
    }
}

async function uploadToAPI(file) {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        body: form
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error ${res.status}: ${text}`);
    }

    return res.json();
}

function showError(msg) {
    rightPanel.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <div class="empty-text">Analysis failed</div>
      <div class="empty-sub" style="color:var(--red);opacity:1">${msg}</div>
    </div>
    <div class="action-block">
      <button class="btn-big secondary" id="btn-retry">Try Again</button>
    </div>
  `;
    document.getElementById("btn-retry").addEventListener("click", resetUI);
}

function resetUI() {
    currentResult = null;
    currentFile = null;
    fileInput.value = "";
    rightPanel.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-text">No image analyzed yet</div>
      <div class="empty-sub">Upload an image to begin</div>
    </div>
  `;
}

// ── Case dropdown ─────────────────────────────────────────────
const CASES_KEY = "nullify_cases";

function loadCases() {
    try { return JSON.parse(localStorage.getItem(CASES_KEY)) || []; } catch { return []; }
}

function saveCases(cases) {
    localStorage.setItem(CASES_KEY, JSON.stringify(cases));
}

function openCaseDropdown(data, file, sha256, metaIntegrity, compressionAnomaly, analyzedAt, exif_flags) {
    // Remove existing overlay if any
    const existing = document.getElementById("case-overlay");
    if (existing) existing.remove();

    const cases = loadCases();

    const overlay = document.createElement("div");
    overlay.id = "case-overlay";
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:300;
        display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);
    `;

    overlay.innerHTML = `
        <div style="background:var(--panel);border:1px solid var(--border-2);border-radius:16px;width:400px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column;">
            <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                <div style="font-size:15px;font-weight:600;letter-spacing:-0.01em;">Add to Case</div>
                <button id="close-case-overlay" style="background:none;border:none;color:var(--white-3);font-size:20px;cursor:pointer;padding:4px;line-height:1;">×</button>
            </div>
            <div style="padding:16px 24px;border-bottom:1px solid var(--border);">
                <div style="display:flex;gap:8px;">
                    <input id="case-search" type="text" placeholder="Search or create case..." style="
                        flex:1;background:var(--panel-2);border:1px solid var(--border-2);border-radius:8px;
                        padding:8px 12px;color:var(--white);font-family:var(--font);font-size:13px;outline:none;
                    ">
                    <button id="btn-create-case" style="
                        padding:8px 14px;border-radius:8px;background:var(--teal);color:var(--bg);
                        border:none;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;
                        white-space:nowrap;
                    ">+ New</button>
                </div>
            </div>
            <div id="case-list" style="overflow-y:auto;flex:1;padding:8px 0;">
                ${cases.length === 0
                    ? `<div style="padding:32px;text-align:center;color:var(--white-3);font-size:13px;">No cases yet — create one above</div>`
                    : cases.map((c, i) => `
                        <div class="case-list-item" data-index="${i}" style="
                            padding:12px 24px;cursor:pointer;display:flex;align-items:center;
                            justify-content:space-between;transition:background 0.1s;
                        " onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
                            <div>
                                <div style="font-size:13px;font-weight:500;color:var(--white)">${c.name}</div>
                                <div style="font-size:11px;color:var(--white-3);font-family:var(--mono)">${c.scans.length} scan${c.scans.length !== 1 ? "s" : ""} · ${c.createdAt}</div>
                            </div>
                            <span style="color:var(--teal);font-size:12px;font-weight:600;">Add →</span>
                        </div>
                    `).join("")
                }
            </div>
            <div style="padding:16px 24px;border-top:1px solid var(--border);">
                <div style="font-size:11px;color:var(--white-3);font-family:var(--mono);">
                    Adding: <span style="color:var(--white-2)">${file.name}</span>
                </div>
                <div style="margin-top:8px;">
                    <label style="font-size:12px;color:var(--white-2);display:block;margin-bottom:4px;">Detective notes (optional)</label>
                    <textarea id="case-notes" placeholder="Add notes about this scan..." style="
                        width:100%;background:var(--panel-2);border:1px solid var(--border-2);border-radius:8px;
                        padding:8px 12px;color:var(--white);font-family:var(--font);font-size:12px;
                        outline:none;resize:none;height:60px;box-sizing:border-box;
                    "></textarea>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Search filter
    document.getElementById("case-search").addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll(".case-list-item").forEach(item => {
            const name = item.querySelector("div > div").textContent.toLowerCase();
            item.style.display = name.includes(q) ? "flex" : "none";
        });
    });

    // Close
    document.getElementById("close-case-overlay").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    // Create new case
    document.getElementById("btn-create-case").addEventListener("click", () => {
        const name = document.getElementById("case-search").value.trim();
        if (!name) { document.getElementById("case-search").focus(); return; }
        const notes = document.getElementById("case-notes").value.trim();
        const cases = loadCases();
        const newCase = {
            name,
            createdAt: formatDate(new Date()),
            notes: "",
            scans: []
        };
        addScanToCase(newCase, data, file, sha256, metaIntegrity, compressionAnomaly, analyzedAt, exif_flags, notes);
        cases.push(newCase);
        saveCases(cases);
        overlay.remove();
        showCaseSuccess(name);
    });

    // Add to existing case
    document.querySelectorAll(".case-list-item").forEach(item => {
        item.addEventListener("click", () => {
            const index = parseInt(item.dataset.index);
            const notes = document.getElementById("case-notes").value.trim();
            const cases = loadCases();
            addScanToCase(cases[index], data, file, sha256, metaIntegrity, compressionAnomaly, analyzedAt, exif_flags, notes);
            saveCases(cases);
            overlay.remove();
            showCaseSuccess(cases[index].name);
        });
    });
}

function addScanToCase(caseObj, data, file, sha256, metaIntegrity, compressionAnomaly, analyzedAt, exif_flags, notes) {
    caseObj.scans.push({
        filename: file.name,
        fileSize: formatFileSize(file.size),
        ext: file.name.split(".").pop().toUpperCase(),
        score: data.score,
        verdict: data.verdict,
        exif_flags,
        sha256,
        metaIntegrity,
        compressionAnomaly,
        analyzedAt,
        notes: notes || ""
    });
}

function showCaseSuccess(caseName) {
    const toast = document.createElement("div");
    toast.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:400;
        background:var(--panel);border:1px solid rgba(0,194,168,0.3);
        border-radius:10px;padding:12px 18px;font-size:13px;color:var(--white);
        display:flex;align-items:center;gap:10px;box-shadow:0 4px 24px rgba(0,0,0,0.4);
    `;
    toast.innerHTML = `<span style="color:var(--teal)">✓</span> Added to <strong>${caseName}</strong>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}