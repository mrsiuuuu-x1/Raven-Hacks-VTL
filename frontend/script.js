/* ============================================================
   RAVEN — script.js
   Handles: drag-and-drop, file upload, scan animation,
            results reveal, heatmap toggle, nav switching
   ============================================================ */


/* ── Grab all the elements we'll need ── */
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const uploadIcon = document.getElementById('uploadIcon');
const uploadTitle = document.getElementById('uploadTitle');
const uploadSub = document.getElementById('uploadSub');
const uploadBtn = document.getElementById('uploadBtn');
const uploadHint = document.getElementById('uploadHint');

const resultsSection = document.getElementById('resultsSection');
const topbarTags = document.getElementById('topbar-tags');
const breadcrumb = document.getElementById('breadcrumb-current');

const previewImg = document.getElementById('previewImg');
const imgPlaceholder = document.getElementById('imgPlaceholder');
const heatmapOverlay = document.getElementById('heatmapOverlay');

const btnOriginal = document.getElementById('btnOriginal');
const btnHeatmap = document.getElementById('btnHeatmap');
const btnNewAnalysis = document.getElementById('btnNewAnalysis');

const logList = document.getElementById('logList');
const metaFile = document.getElementById('metaFile');


/* ── Log entries that appear one-by-one during the fake scan ── */
const LOG_ENTRIES = [
    { delay: 400, cls: 'ok', msg: 'Image received · hash verified' },
    { delay: 800, cls: '', msg: 'EXIF extraction complete · 8 fields' },
    { delay: 1200, cls: 'warn', msg: '⚠ Camera model field absent' },
    { delay: 1600, cls: 'warn', msg: '⚠ GPS data stripped post-capture' },
    { delay: 2000, cls: 'warn', msg: '⚠ Photoshop edit signature detected' },
    { delay: 2500, cls: '', msg: 'Hive API inference initiated...' },
    { delay: 3300, cls: 'err', msg: '✕ AI score 87.4% — exceeds threshold' },
    { delay: 3700, cls: 'err', msg: '✕ 2 suspicious regions flagged' },
    { delay: 4100, cls: 'ok', msg: 'Report compiled · analysis complete' },
];

/* Scanning status messages that cycle in the upload card */
const SCAN_MESSAGES = [
    'Verifying file integrity...',
    'Reading EXIF metadata...',
    'Sending to Hive AI model...',
    'Compiling results...',
];


/* ============================================================
   DRAG AND DROP
   ============================================================ */

// Prevent browser from opening the file when dropped outside the zone
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// When a file is dragged over the upload zone
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
    uploadTitle.textContent = 'Release to scan this file';
});

// When the drag leaves the upload zone
uploadZone.addEventListener('dragleave', (e) => {
    // Only fire if we've actually left the zone (not just moved to a child element)
    if (!uploadZone.contains(e.relatedTarget)) {
        uploadZone.classList.remove('drag-over');
        uploadTitle.textContent = 'Drop an image or video here';
    }
});

// When a file is dropped onto the upload zone
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
});

// Click anywhere on the zone (except the button itself) to open file picker
uploadZone.addEventListener('click', (e) => {
    if (e.target !== uploadBtn && !uploadBtn.contains(e.target)) {
        fileInput.click();
    }
});

// Click the Browse Files button
uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

// When a file is chosen via the file picker
fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
});


/* ============================================================
   FILE HANDLING
   ============================================================ */

const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
    'video/mp4', 'video/quicktime',
];

function handleFile(file) {
    // Reject unsupported formats
    if (!ALLOWED_TYPES.includes(file.type)) {
        uploadTitle.textContent = 'Unsupported file format';
        uploadTitle.style.color = 'var(--danger)';
        setTimeout(() => {
            uploadTitle.textContent = 'Drop an image or video here';
            uploadTitle.style.color = '';
        }, 2500);
        return;
    }

    startScanAnimation(file);
}


/* ============================================================
   SCAN ANIMATION
   ============================================================ */

function startScanAnimation(file) {
    // Switch upload card into "scanning" state
    uploadZone.classList.add('scanning');

    // Hide the normal upload UI elements
    uploadIcon.style.display = 'none';
    uploadSub.style.display = 'none';
    uploadBtn.style.display = 'none';
    uploadHint.style.display = 'none';
    document.querySelector('.upload-formats').style.display = 'none';

    uploadTitle.textContent = 'Scanning file...';

    // Add the animated scan bar line
    const scanBar = document.createElement('div');
    scanBar.className = 'scan-bar';
    uploadZone.appendChild(scanBar);

    // Add the cycling status text
    const statusText = document.createElement('div');
    statusText.className = 'scan-status-text';
    statusText.textContent = SCAN_MESSAGES[0];
    uploadZone.appendChild(statusText);

    // Cycle through scan messages every 900ms
    let msgIndex = 1;
    const msgInterval = setInterval(() => {
        if (msgIndex < SCAN_MESSAGES.length) {
            statusText.textContent = SCAN_MESSAGES[msgIndex++];
        }
    }, 900);

    // Pre-build all log entries (invisible) so they can fade in
    buildLogEntries();

    // Trigger each log entry to appear at its scheduled delay
    LOG_ENTRIES.forEach((entry, i) => {
        setTimeout(() => {
            const el = logList.querySelectorAll('.log-item')[i];
            if (el) el.classList.add('visible');
        }, entry.delay);
    });

    // After the full scan duration, show the loaded state + results
    const SCAN_DURATION = 4600;
    setTimeout(() => {
        clearInterval(msgInterval);
        scanBar.remove();
        statusText.remove();
        uploadZone.classList.remove('scanning');
        uploadZone.style.pointerEvents = 'auto';

        showLoadedState(file);
    }, SCAN_DURATION);
}


/* ============================================================
   BUILD LOG ENTRIES (pre-rendered, faded in one by one)
   ============================================================ */

function buildLogEntries() {
    logList.innerHTML = '';
    const now = new Date();

    LOG_ENTRIES.forEach((entry, i) => {
        const time = new Date(now.getTime() + entry.delay);
        const timeStr = time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const item = document.createElement('div');
        item.className = `log-item ${entry.cls}`;
        item.innerHTML = `<span class="time">${timeStr}</span><span class="msg">${entry.msg}</span>`;
        logList.appendChild(item);
    });
}


/* ============================================================
   LOADED STATE — show file info in upload card + reveal results
   ============================================================ */

function showLoadedState(file) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    const typeLabel = file.type.split('/')[1].toUpperCase();

    // Update upload card to show a compact file summary
    uploadZone.innerHTML = '';
    uploadZone.style.padding = '20px 24px';
    uploadZone.style.cursor = 'default';

    const row = document.createElement('div');
    row.className = 'loaded-file-row';

    if (file.type.startsWith('image/')) {
        // Read the image and show a thumbnail
        const reader = new FileReader();
        reader.onload = (ev) => {
            row.innerHTML = `
        <img class="loaded-thumb" src="${ev.target.result}" alt="Preview">
        <div class="loaded-info">
          <div class="loaded-name">${file.name}</div>
          <div class="loaded-meta">${typeLabel} · ${sizeMB} MB</div>
          <div class="loaded-change" id="changeFileBtn">↩ Change file</div>
        </div>
      `;
            uploadZone.appendChild(row);
            document.getElementById('changeFileBtn').addEventListener('click', resetToUpload);

            // Also show the image in the preview panel
            previewImg.src = ev.target.result;
            previewImg.style.display = 'block';
            imgPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    } else {
        // Video file — show a placeholder icon instead of thumbnail
        row.innerHTML = `
      <div class="loaded-thumb-placeholder">VIDEO</div>
      <div class="loaded-info">
        <div class="loaded-name">${file.name}</div>
        <div class="loaded-meta">${typeLabel} · ${sizeMB} MB</div>
        <div class="loaded-change" id="changeFileBtn">↩ Change file</div>
      </div>
    `;
        uploadZone.appendChild(row);
        document.getElementById('changeFileBtn').addEventListener('click', resetToUpload);
    }

    // Update the EXIF metadata row with the real filename
    metaFile.textContent = `${file.name} · ${sizeMB} MB · ${typeLabel}`;

    // Update breadcrumb
    breadcrumb.textContent = file.name;

    // Show verdict tags in the top bar
    topbarTags.innerHTML = `
    <span class="tag tag-danger"><span class="dot"></span>Definitely AI</span>
    <span class="tag tag-accent">87% confidence</span>
  `;

    // Reveal the results section
    resultsSection.style.display = 'flex';

    // Scroll down to results smoothly
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
}


/* ============================================================
   RESET — go back to the upload state
   ============================================================ */

function resetToUpload() {
    // Reset upload card HTML
    uploadZone.innerHTML = `
    <div class="upload-card-icon" id="uploadIcon">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 16V8M12 8l-4 4M12 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="upload-title" id="uploadTitle">Drop an image or video here</div>
    <div class="upload-sub" id="uploadSub">Upload any image or video to scan it for AI manipulation, deepfakes, and metadata anomalies.</div>
    <button class="upload-cta" id="uploadBtn">Browse Files</button>
    <div class="upload-formats">
      <span class="format-pill">JPG</span>
      <span class="format-pill">PNG</span>
      <span class="format-pill">WEBP</span>
      <span class="format-pill">TIFF</span>
      <span class="format-pill">MP4</span>
      <span class="format-pill">MOV</span>
    </div>
    <div class="upload-drag-hint" id="uploadHint">or drag and drop a file anywhere in this box</div>
  `;

    // Reset styles
    uploadZone.style.padding = '';
    uploadZone.style.cursor = '';
    uploadZone.classList.remove('scanning', 'drag-over');

    // Re-attach the browse button listener (since we just re-rendered the HTML)
    document.getElementById('uploadBtn').addEventListener('click', () => fileInput.click());

    // Hide results
    resultsSection.style.display = 'none';

    // Reset preview
    previewImg.style.display = 'none';
    previewImg.src = '';
    imgPlaceholder.style.display = 'flex';
    heatmapOverlay.style.display = 'none';

    // Reset heatmap toggle buttons
    btnOriginal.classList.add('active');
    btnHeatmap.classList.remove('active');

    // Reset top bar
    topbarTags.innerHTML = '';
    breadcrumb.textContent = 'New Analysis';

    // Clear file input so the same file can be re-selected
    fileInput.value = '';

    // Scroll back to top
    document.querySelector('.content').scrollTo({ top: 0, behavior: 'smooth' });
}

// "New Analysis" button in the results panel
btnNewAnalysis.addEventListener('click', resetToUpload);


/* ============================================================
   HEATMAP TOGGLE
   ============================================================ */

btnOriginal.addEventListener('click', () => {
    btnOriginal.classList.add('active');
    btnHeatmap.classList.remove('active');
    heatmapOverlay.style.display = 'none';
});

btnHeatmap.addEventListener('click', () => {
    btnHeatmap.classList.add('active');
    btnOriginal.classList.remove('active');
    heatmapOverlay.style.display = 'block';
});


/* ============================================================
   SIDEBAR NAVIGATION (highlight active link)
   ============================================================ */

document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
        document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
    });
});