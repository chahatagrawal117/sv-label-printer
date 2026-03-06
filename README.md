# SV Graphics — Label Printer

Automates the BigShip → Print → Stick workflow for SV Graphics.

**Live tool:** https://chahatagrawal117.github.io/sv-label-printer

---

## 🗂 Files to upload to GitHub

```
index.html                    ← Label Arranger (GitHub Pages)
bigship-downloader.user.js    ← Tampermonkey script for BigShip
README.md                     ← This file
```

---

## 🔄 Daily Workflow

```
On BigShip Reports page:

  [ ▶ Start Collecting ]
        ↓
  Click Action → Print Label for each order (as normal)
  Counter shows:  1 ✓   2 ✓   3 ✓ ...
        ↓
  [ ⏹ Stop ]
        ↓
  [ 📦 Download ZIP ]   [ 🖨 Open in Label Arranger ]

  → "Open in Label Arranger" opens GitHub page + auto-loads all labels
  → Click "⬇ Download Print PDF"
  → Print → Cut → Stick ✓
```

---

## 📦 Tool 1 — BigShip Label Collector

**File:** `bigship-downloader.user.js`

### Install
1. Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome
2. Click Tampermonkey icon → **Create new script**
3. Delete all existing code → paste full contents of `bigship-downloader.user.js`
4. Press **Ctrl+S** to save

### Button states

| State | What you see |
|-------|-------------|
| Ready | `▶ Start Collecting` |
| Collecting | `⏹ Stop`  +  `3 labels ✓` counter |
| Stopped | `▶ Start Again`  `3 labels ✓`  `📦 Download ZIP`  `🖨 Open in Label Arranger`  `✕ Clear` |

### Rules
- **Start collecting FIRST**, then click Print Label for each order
- Counter flashes green each time a label is captured
- **Stop first** before downloading — ZIP and Label Arranger buttons only appear after stopping
- **✕ Clear** resets everything — use when starting a new print session
- **▶ Start Again** adds more labels on top of existing ones (useful if you missed some)
- Each ZIP is named with date+time: `Labels_2026-03-06_1430.zip` — sessions never mix

---

## 🖨 Tool 2 — Label Arranger

**URL:** https://chahatagrawal117.github.io/sv-label-printer

When opened via **🖨 Open in Label Arranger**, labels load automatically — no manual upload needed.

### Manual loading options
- Drop the ZIP file onto the drop zone
- Click **📄 Choose ZIP / PDF**
- Click **📁 Choose Folder** → select folder of PDFs

### Layout options (per sheet)

| Layout | Labels per sheet | When to use |
|--------|-----------------|-------------|
| **4-up** | 4 (2×2 grid) | Default — most orders |
| **2-up** | 2 (full width rows) | Large/landscape labels |
| **1+2**  | 3 (1 big + 2 small) | Mixed sizes |

Each A4 sheet has its own layout — change any sheet independently.

### Output filename
```
SV_Labels_2026-03-06_1430_7labels_2pages.pdf
```

---

## 🌐 GitHub Pages Setup

1. Create repo named **`sv-label-printer`** at github.com/chahatagrawal117
2. Upload all 3 files (`index.html`, `bigship-downloader.user.js`, `README.md`)
3. Go to **Settings → Pages → Source → Deploy from branch → main → / (root) → Save**
4. Live at: **https://chahatagrawal117.github.io/sv-label-printer**

---

## ❓ Troubleshooting

| Problem | Fix |
|---------|-----|
| Counter not ticking up | Make sure you clicked ▶ Start Collecting BEFORE clicking Print Label |
| Label Arranger opens but no labels load | Must open within 5 minutes · Use Chrome · Must be GitHub Pages URL (not local file) |
| Same label downloaded multiple times | Click ✕ Clear and start fresh |
| Labels appear sideways | Click ↺ rotate on the thumbnail |
| ZIP is empty | The interception missed — retry with Start Collecting |

---

## 🛠 Tech Stack

| Purpose | Library |
|---------|---------|
| PDF rendering | PDF.js 3.11 |
| PDF generation | jsPDF 2.5 |
| ZIP creation | JSZip 3.10 |
| Fonts | Google Fonts — Syne, DM Mono |
| Browser automation | Tampermonkey |

No build step. No npm. No server. Works 100% in the browser.

---

*Internal tool — SV Graphics*
