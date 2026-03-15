const STORAGE_KEY = "raven_scan_history";

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
}

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

function renderHistory() {
    const history = loadHistory();
    const body = document.getElementById("history-body");
    const countEl = document.getElementById("scan-count");

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

    const rows = [...history].reverse().map((scan, i) => {
        const vc = getVerdictClass(scan.verdict);
        const scoreColor = getScoreColor(scan.score);
        const metaColor = scan.metaIntegrity >= 70 ? "var(--green)" : scan.metaIntegrity >= 40 ? "var(--amber)" : "var(--red)";
        return `
        <tr onclick="openDetail(${history.length - 1 - i})">
            <td class="td-filename">${scan.filename}</td>
            <td class="td-score" style="color:${scoreColor}">${scan.score}%</td>
            <td><span class="verdict-pill ${vc}">${scan.verdict}</span></td>
            <td class="td-meta" style="color:${metaColor}">${scan.metaIntegrity >= 70 ? "Good" : scan.metaIntegrity >= 40 ? "Partial" : "Poor"} (${scan.metaIntegrity}%)</td>
            <td class="td-date">${scan.analyzedAt}</td>
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

function openDetail(index) {
    const history = loadHistory();
    const scan = history[index];
    if (!scan) return;

    const vc = getVerdictClass(scan.verdict);
    const scoreColor = getScoreColor(scan.score);
    const metaColor = scan.metaIntegrity >= 70 ? "var(--green)" : scan.metaIntegrity >= 40 ? "var(--amber)" : "var(--red)";
    const compColor = getScoreColor(scan.compressionAnomaly);
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
                <div class="modal-meta">${scan.fileSize} · ${scan.ext} · ${scan.analyzedAt}</div>
            </div>
            <button class="modal-close" onclick="closeDetail()">×</button>
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
                    <span class="score-row-val" style="color:${metaColor}">${scan.metaIntegrity >= 70 ? "Good" : scan.metaIntegrity >= 40 ? "Partial" : "Poor"} (${scan.metaIntegrity}%)</span>
                </div>
                <div class="score-track"><div class="score-track-fill" style="width:${scan.metaIntegrity}%;background:${metaColor}"></div></div>
            </div>
            <div class="score-row">
                <div class="score-row-header">
                    <span class="score-row-label">Compression Anomaly</span>
                    <span class="score-row-val" style="color:${compColor}">${scan.compressionAnomaly} / 100</span>
                </div>
                <div class="score-track"><div class="score-track-fill" style="width:${scan.compressionAnomaly}%;background:${compColor}"></div></div>
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
            <button class="btn-big secondary" onclick="closeDetail()">Close</button>
        </div>
    `;

    document.getElementById("modal-overlay").classList.add("open");
}

function closeDetail() {
    document.getElementById("modal-overlay").classList.remove("open");
}

document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) closeDetail();
});

document.getElementById("btn-clear").addEventListener("click", () => {
    const history = loadHistory();
    document.getElementById("confirm-count").textContent = `${history.length} scan${history.length !== 1 ? "s" : ""}`;
    document.getElementById("confirm-overlay").classList.add("open");
});

document.getElementById("confirm-cancel").addEventListener("click", () => {
    document.getElementById("confirm-overlay").classList.remove("open");
});

document.getElementById("confirm-ok").addEventListener("click", () => {
    document.getElementById("confirm-overlay").classList.remove("open");
    clearHistory();
});

document.getElementById("confirm-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("confirm-overlay")) {
        document.getElementById("confirm-overlay").classList.remove("open");
    }
});

renderHistory();