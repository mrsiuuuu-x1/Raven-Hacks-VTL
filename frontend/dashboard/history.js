import { getScans, clearAllScans, getUser } from "../supabase.js";

async function loadUser() {
    const navUser = document.querySelector('.nav-user');
    if (!navUser) return;
    const user = await getUser();
    if (user) {
        navUser.textContent = user.user_metadata?.username || user.email;
    } else {
        navUser.textContent = "Det. A. Rahman"; // temp fallback for local testing
        // window.location.href = "../index.html"; // uncomment on Vercel
    }
}
loadUser();

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

let currentHistory = [];

async function renderHistory() {
    const body = document.getElementById("history-body");
    const countEl = document.getElementById("scan-count");

    body.innerHTML = `<div style="padding: 20px; color: var(--white-3);">Loading records...</div>`;

    const { data: history, error } = await getScans();

    if (error) {
        body.innerHTML = `<div style="color: var(--red); padding: 20px;">Error loading history: ${error}</div>`;
        return;
    }

    currentHistory = history;
    countEl.textContent = history.length > 0 ? `${history.length} scan${history.length > 1 ? "s" : ""}` : "";

    if (history.length === 0) {
        body.innerHTML = `
            <div class="empty-history">
                <div class="empty-history-icon">🗂</div>
                <div class="empty-history-text">No scans yet</div>
                <div class="empty-history-sub">Analyzed images will appear here</div>
                <a class="empty-history-link" href="index.html">← Go to Dashboard</a>
            </div>
        `;
        return;
    }

    const rows = history.map((scan, i) => {
        const vc = getVerdictClass(scan.verdict);
        const scoreColor = getScoreColor(scan.score);
        const metaColor = scan.meta_integrity >= 70 ? "var(--green)" : scan.meta_integrity >= 40 ? "var(--amber)" : "var(--red)";
        return `
        <tr onclick="window.openDetail(${i})">
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

window.openDetail = function (index) {
    const scan = currentHistory[index];
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
        <div class="action-block">
            <button class="btn-big secondary" onclick="window.closeDetail()">Close</button>
        </div>
    `;

    document.getElementById("modal-overlay").classList.add("open");
}

window.closeDetail = function () {
    document.getElementById("modal-overlay").classList.remove("open");
}

document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) window.closeDetail();
});

document.getElementById("btn-clear").addEventListener("click", () => {
    document.getElementById("confirm-count").textContent = `${currentHistory.length} scan${currentHistory.length !== 1 ? "s" : ""}`;
    document.getElementById("confirm-overlay").classList.add("open");
});

document.getElementById("confirm-cancel").addEventListener("click", () => {
    document.getElementById("confirm-overlay").classList.remove("open");
});

document.getElementById("confirm-ok").addEventListener("click", async () => {
    document.getElementById("confirm-overlay").classList.remove("open");
    const btn = document.getElementById("confirm-ok");
    btn.textContent = "Clearing...";
    await clearAllScans();
    btn.textContent = "Clear All";
    renderHistory();
});

document.getElementById("confirm-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("confirm-overlay")) {
        document.getElementById("confirm-overlay").classList.remove("open");
    }
});

renderHistory();