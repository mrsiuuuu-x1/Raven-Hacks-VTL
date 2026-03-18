import { getCases, deleteCase as supabaseDeleteCase, getUser } from "../supabase.js";

// Route Guard
getUser().then(user => {
    if (!user) window.location.href = "../login.html";
});

function getVerdictClass(verdict) {
    if (verdict === "Definitely AI") return "ai";
    if (verdict === "Likely AI") return "likely";
    return "real";
}

function getScoreColor(val) {
    if (val >= 70) return "var(--red)";
    if (val >= 30) return "var(--amber)";
    return "var(--green)";
}

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
    return (bytes / (1024 * 1024)).toFixed(2) + "MB";
}

let currentCases = [];
let currentCaseIndex = null;
let currentFilter = "all";

async function renderCases() {
    const body = document.getElementById("cases-body");
    const countEl = document.getElementById("case-count");
    
    body.innerHTML = `<div style="padding: 20px; color: var(--white-3);">Loading cases...</div>`;

    const { data: cases, error } = await getCases();
    if (error) {
        body.innerHTML = `<div style="color: var(--red); padding: 20px;">Error loading cases: ${error}</div>`;
        return;
    }

    currentCases = cases;
    countEl.textContent = cases.length > 0 ? `${cases.length} case${cases.length !== 1 ? "s" : ""}` : "";

    if (cases.length === 0) {
        body.innerHTML = `
            <div class="empty-cf">
                <div class="empty-cf-icon">🗄️</div>
                <div class="empty-cf-text">No cases yet</div>
                <div class="empty-cf-sub">Use "Add to Case" after scanning an image to create a case</div>
                <a class="empty-cf-link" href="index.html">← Go to Dashboard</a>
            </div>
        `;
        return;
    }

    const cards = cases.map((c, i) => {
        const scans = c.case_scans || [];
        const aiCount = scans.filter(s => s.verdict === "Definitely AI").length;
        const likelyCount = scans.filter(s => s.verdict === "Likely AI").length;
        const realCount = scans.filter(s => s.verdict === "Real").length;

        return `
        <div class="case-card" onclick="window.openCase(${i})">
            <button class="case-card-delete" onclick="event.stopPropagation(); window.triggerDeleteCase(${i})">✕</button>
            <div class="case-card-icon">🗂️</div>
            <div class="case-card-name">${c.name}</div>
            <div class="case-card-meta">Created ${c.created_at} · ${scans.length} scan${scans.length !== 1 ? "s" : ""}</div>
            ${c.notes ? `<div class="case-card-notes">${c.notes}</div>` : ""}
            <div class="case-card-stats">
                <span class="case-stat total">${scans.length} total</span>
                ${aiCount > 0 ? `<span class="case-stat ai">${aiCount} Definitely AI</span>` : ""}
                ${likelyCount > 0 ? `<span class="case-stat likely">${likelyCount} Likely AI</span>` : ""}
                ${realCount > 0 ? `<span class="case-stat real">${realCount} Real</span>` : ""}
            </div>
        </div>`;
    }).join("");

    body.innerHTML = `<div class="cases-grid">${cards}</div>`;
}

window.openCase = function(index) {
    currentCaseIndex = index;
    currentFilter = "all";
    const c = currentCases[index];

    document.getElementById("view-cases").style.display = "none";
    document.getElementById("view-case").style.display = "block";
    document.getElementById("case-title").textContent = c.name;
    
    const scanCount = c.case_scans ? c.case_scans.length : 0;
    document.getElementById("case-eyebrow").textContent = `${scanCount} scan${scanCount !== 1 ? "s" : ""} · ${c.created_at}`;

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.filter === "all");
    });

    renderCaseScans(c.case_scans || []);
}

function renderCaseScans(scans) {
    const body = document.getElementById("case-scans-body");
    const filtered = currentFilter === "all" ? scans : scans.filter(s => s.verdict === currentFilter);

    if (filtered.length === 0) {
        body.innerHTML = `
            <div class="empty-case">
                <div style="font-size:32px;opacity:0.3">🔍</div>
                <div style="font-size:13px;color:var(--white-2)">No scans match this filter</div>
            </div>
        `;
        return;
    }

    const rows = filtered.map((scan, i) => {
        const vc = getVerdictClass(scan.verdict);
        const scoreColor = getScoreColor(scan.score);
        const metaColor = scan.meta_integrity >= 70 ? "var(--green)" : scan.meta_integrity >= 40 ? "var(--amber)" : "var(--red)";
        const originalIndex = scans.indexOf(scan);
        return `
        <tr onclick="window.openScanDetail(${currentCaseIndex}, ${originalIndex})">
            <td class="td-filename">${scan.filename}</td>
            <td class="td-score" style="color:${scoreColor}">${scan.score}%</td>
            <td><span class="verdict-pill ${vc}">${scan.verdict}</span></td>
            <td class="td-meta" style="color:${metaColor}">${scan.meta_integrity >= 70 ? "Good" : scan.meta_integrity >= 40 ? "Partial" : "Poor"} (${scan.meta_integrity}%)</td>
            <td class="td-date">${scan.analyzed_at}</td>
            <td class="td-arrow">›</td>
        </tr>`;
    }).join("");

    body.innerHTML = `
        <table class="scan-table">
            <thead>
                <tr>
                    <th>Filename</th>
                    <th>AI Score</th>
                    <th>Verdict</th>
                    <th>Metadata</th>
                    <th>Analyzed</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

window.openScanDetail = function(caseIndex, scanIndex) {
    const scan = currentCases[caseIndex].case_scans[scanIndex];
    if (!scan) return;

    const vc = getVerdictClass(scan.verdict);
    const scoreColor = getScoreColor(scan.score);
    const metaColor = scan.meta_integrity >= 70 ? "var(--green)" : scan.meta_integrity >= 40 ? "var(--amber)" : "var(--red)";
    const compColor = getScoreColor(scan.compression_anomaly);
    const noExif = scan.exif_flags.includes("No EXIF data found");
    const isFlagged = (kw) => noExif || scan.exif_flags.some(f => f.toLowerCase().includes(kw.toLowerCase()));
    const softwareFlag = scan.exif_flags.find(f => f.startsWith("Edited with software:"));
    const softwareVal = softwareFlag ? softwareFlag.replace("Edited with software: ", "") : null;
    const shortHash = scan.sha256.slice(0, 8) + "..." + scan.sha256.slice(-8);
    const flagCount = scan.exif_flags.filter(f => !f.startsWith("No suspicious")).length;

    document.getElementById("modal-content").innerHTML = `
        <div class="modal-header">
            <div>
                <div class="modal-title">${scan.filename}</div>
                <div class="modal-meta">${formatFileSize(scan.file_size)} · ${scan.ext} · ${scan.analyzed_at}</div>
            </div>
            <button class="modal-close" onclick="window.closeDetail()">×</button>
        </div>
        ${scan.thumbnail ? `
        <div style="padding:16px 24px;border-bottom:1px solid var(--border);">
            <img src="${scan.thumbnail}" style="width:100%;border-radius:8px;object-fit:cover;max-height:180px;display:block;" alt="scan thumbnail">
        </div>` : ""}
        <div class="verdict-block ${vc}">
            <div class="verdict-number">${scan.score}<span style="font-size:36px">%</span></div>
            <div class="verdict-unit">AI-generated probability</div>
            <div class="verdict-text">${scan.verdict}</div>
            <div class="verdict-sub">${flagCount > 0 ? flagCount + " metadata flag(s) detected" : "No metadata flags"}</div>
        </div>
        <div class="scores-block">
            <div class="score-row">
                <div class="score-row-header">
                    <span class="score-row-label">AI Manipulation Score</span>
                    <span class="score-row-val" style="color:${scoreColor}">${scan.score}%</span>
                </div>
                <div class="score-track"><div class="score-track-fill" style="width:${scan.score}%;background:${scoreColor}"></div></div>
            </div>
            <div class="score-row">
                <div class="score-row-header">
                    <span class="score-row-label">Metadata Integrity</span>
                    <span class="score-row-val" style="color:${metaColor}">${scan.meta_integrity >= 70 ? "Good" : scan.meta_integrity >= 40 ? "Partial" : "Poor"} (${scan.meta_integrity}%)</span>
                </div>
                <div class="score-track"><div class="score-track-fill" style="width:${scan.meta_integrity}%;background:${metaColor}"></div></div>
            </div>
            <div class="score-row">
                <div class="score-row-header">
                    <span class="score-row-label">Compression Anomaly</span>
                    <span class="score-row-val" style="color:${compColor}">${scan.compression_anomaly} / 100</span>
                </div>
                <div class="score-track"><div class="score-track-fill" style="width:${scan.compression_anomaly}%;background:${compColor}"></div></div>
            </div>
        </div>
        <div class="meta-block">
            <div class="block-label">EXIF Metadata</div>
            <div class="meta-list">
                <div class="m-row"><span class="m-key">Camera Model</span><span class="m-val">${isFlagged("no camera") ? `<span style="color:var(--white-3)">— not found<span class="flag">FLAG</span></span>` : `<span style="color:var(--white)">Present</span>`}</span></div>
                <div class="m-row"><span class="m-key">GPS Data</span><span class="m-val">${isFlagged("no gps") ? `<span style="color:var(--white-3)">— not found<span class="flag">FLAG</span></span>` : `<span style="color:var(--white)">Present</span>`}</span></div>
                <div class="m-row"><span class="m-key">Timestamp</span><span class="m-val">${isFlagged("no original capture") ? `<span style="color:var(--white-3)">— not found<span class="flag">FLAG</span></span>` : `<span style="color:var(--white)">Present</span>`}</span></div>
                <div class="m-row"><span class="m-key">Software</span><span class="m-val">${softwareVal ? `<span style="color:var(--amber)">${softwareVal}<span class="flag">FLAG</span></span>` : `<span style="color:var(--white-3)">—</span>`}</span></div>
                <div class="m-row"><span class="m-key">File Type</span><span class="m-val"><span>${scan.ext}</span></span></div>
                <div class="m-row"><span class="m-key">SHA-256</span><span class="m-val"><span style="font-size:10px;color:var(--white-2)">${shortHash}</span></span></div>
            </div>
        </div>
        ${scan.notes ? `<div class="meta-block"><div class="block-label">Detective Notes</div><div style="padding:8px 0;font-size:13px;color:var(--white-2);line-height:1.6">${scan.notes}</div></div>` : ""}
        ${scan.reasoning ? `<div class="meta-block"><div class="block-label">Forensic Reasoning</div><div style="padding:8px 0;">${scan.reasoning.split("\n\n").map(p => `<p style="font-size:12px;color:var(--white-2);line-height:1.75;margin-bottom:10px;">${p}</p>`).join("")}</div></div>` : ""}
        <div class="action-block">
            <button class="btn-big secondary" onclick="window.closeDetail()">Close</button>
        </div>
    `;

    document.getElementById("modal-overlay").classList.add("open");
}

window.closeDetail = function() {
    document.getElementById("modal-overlay").classList.remove("open");
}

let pendingDeleteId = null;

window.triggerDeleteCase = function(index) {
    const c = currentCases[index];
    document.getElementById("delete-case-name").textContent = `"${c.name}"`;
    pendingDeleteId = c.id; 
    document.getElementById("delete-overlay").classList.add("open");
}

document.getElementById("delete-cancel").addEventListener("click", () => {
    document.getElementById("delete-overlay").classList.remove("open");
    pendingDeleteId = null;
});

document.getElementById("delete-confirm").addEventListener("click", async () => {
    if (pendingDeleteId !== null) {
        await supabaseDeleteCase(pendingDeleteId);
        pendingDeleteId = null;
    }
    document.getElementById("delete-overlay").classList.remove("open");
    renderCases();
});

document.getElementById("delete-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("delete-overlay")) {
        document.getElementById("delete-overlay").classList.remove("open");
        pendingDeleteId = null;
    }
});

// Filter buttons
document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        if (currentCaseIndex !== null) renderCaseScans(currentCases[currentCaseIndex].case_scans || []);
    });
});

// Back button
document.getElementById("btn-back").addEventListener("click", () => {
    document.getElementById("view-case").style.display = "none";
    document.getElementById("view-cases").style.display = "block";
    currentCaseIndex = null;
    renderCases();
});

// Close modal on overlay click
document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) window.closeDetail();
});

renderCases();