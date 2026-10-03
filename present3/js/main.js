/* ─────────────────────────────────────────────────────────────
   The Monitor Reads What the Model Never Says — final presentation engine
   Same stage as talks 1-2: content on the left, the paper sits still
   on the right; only the paper's internal scroll and the amber
   highlight marker move. All paper positions resolve via text
   search (reflow-safe). PDF is embedded base64 (paper_data.js).
   ───────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  /* ── inline SVG icons (offline, stroke-based) ──────────────── */
  const IC = {
    brain: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12c1-1.6 2.2-1.6 3.5 0s2.5 1.6 3.5 0M12 3.5v3M12 17.5v3"/></svg>',
    lens: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
    split: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16" stroke-dasharray="3 3"/><path d="M6.5 12h2M15.5 12h2"/></svg>',
    shield: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7.5 3v6c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V6z"/><path d="M9 12l2 2 4-4.5"/></svg>',
    mark: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z" opacity="0"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M4 6l3-2M20 6l-3-2"/></svg>',
    text: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h14M5 10h14M5 14h9M5 18h6"/></svg>',
    layers: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    tag: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="9" cy="9" r="1.6" fill="currentColor" stroke="none"/></svg>',
  };

  /* ── scene definitions ─────────────────────────────────────── */
  const SCENES = [
    {
      kicker: "CSI-435/535 · Final presentation",
      title: 'The Monitor Reads What the Model <span class="em uline">Never Says</span>',
      html: `<div class="scene-sub">Causality: push the truth direction, flip the answer · Hidden knowledge: the secret word, found mid-stack</div>
             <div class="scene-meta">Final · Fall 2026 · Group 8</div>`,
      anchor: { search: null, page: 1, frac: 0 },
      paperless: true,
      notes: "<p>开场直接给结论：期中我们读懂了方向；这次证明两件事——方向有因果效力，秘密能被监控器抓到。</p><p>右侧论文稍后出现。</p>",
    },
    {
      kicker: "The story so far",
      title: "One direction, and it <span class='em'>travels</span>",
      html: `
        <figure class="fig-card small">
          <img src="assets/pca_two_clusters.png" alt="PCA: true and false statements form two clusters">
          <figcaption>LLaMA-2-13B, layer 14 — PCA without labels</figcaption>
        </figure>
        <ul class="bullets">
          <li>True and false statements separate — a <b>linear truth direction</b></li>
          <li>It <b>travels</b>: trained on numbers, tested on Spanish–English translation — <b>0.97</b></li>
          <li>It breaks on negation (0.33); <b>label-free CCS</b> repairs it (0.97)</li>
          <li>Control: the answer is <b>not in the words</b> — text baseline at chance</li>
        </ul>`,
      anchor: { search: "Two clusters", page: 3, frac: 0.08 },
      paperless: true,
      notes: "<p>45 秒回顾期中四个结果：方向、迁移、否定翻车+CCS 修复、文字对照。节奏快，评委都听过期中。</p><p>收尾一句：但那些全是“读”——今天先问“读”能不能变成“动”。</p>",
    },
    {
      kicker: "The open question",
      title: "Reading is not <span class='em'>using</span>",
      html: `
        <ul class="icon-bullets">
          <li>${IC.lens}<span>A probe can <b>read</b> the direction — 0.99 held-out, 0.97 transfer</span></li>
          <li>${IC.brain}<span>But correlation is not causation — maybe the model computes truth <b>elsewhere</b>, and our line is only an echo of it</span></li>
          <li>${IC.split}<span>The test: <b>push the direction</b> into the residual stream and watch whether the answer <b>flips</b></span></li>
        </ul>
        <div class="risk-card">${IC.shield}<span>If adding the line moves <b>P(TRUE) − P(FALSE)</b> across zero, the direction is not a shadow of the computation — it <b>is</b> part of it.</span></div>`,
      anchor: { search: "pushing along the truth direction", page: 4, frac: 0.2 },
      mark: { search: "pushing along the truth direction", up: 12, h: 17 },
      notes: "<p>把“分类≠因果”讲成一个具体的怀疑：也许方向只是计算的回声。</p><p>检验方法一句话：把方向加进残差流，看回答翻不翻。</p>",
    },
    {
      kicker: "Result · intervention",
      title: "Push the line, <span class='em'>flip the answer</span>",
      html: `
        <figure class="fig-card">
          <img src="assets/intervention_label_flip.png" alt="Intervening on the truth direction flips P(TRUE) minus P(FALSE) across zero">
          <figcaption>MM direction added / subtracted at layers 8–14 · 177 held-out sp_en_trans statements</figcaption>
        </figure>
        <ul class="bullets">
          <li>True statements: <b>+0.12 → −0.09</b> when the direction is subtracted</li>
          <li>False statements: <b>−0.09 → +0.06</b> when it is added</li>
          <li>The sign of the gap <b>flips in both directions</b> — the original's pattern, reproduced</li>
        </ul>
        <div class="evidence-hint">${IC.mark} highlighted in the paper: Figure 8</div>`,
      anchor: { search: "The probe direction is causally used", page: 7, frac: 0.3, lift: 240 },
      mark: { search: "The probe direction is causally used", up: 12, h: 30 },
      notes: "<p>期末第一个硬结果。读图：四根柱——真句不干预 +0.12，真句减方向 −0.09；假句不干预 −0.09，假句加方向 +0.06。</p><p>强调“双向过零”：不是扰动，是沿着语义方向精确地改口。</p>",
    },
    {
      kicker: "What this buys",
      title: "The direction is <span class='em'>causally used</span>",
      html: `
        <ul class="bullets">
          <li>Original NIE targets (Table 2): <b>MM directions are far more causal</b> than LR — 0.90 vs 0.19</li>
          <li>Our effect sizes are <b>smaller</b> — one fixed steering scale, no per-layer tuning <span class="dim">(same caveat as the original's appendix)</span></li>
          <li>So the midterm's probes were not reading a shadow: the model <b>uses</b> this direction when it answers</li>
        </ul>
        <div class="risk-card">${IC.shield}<span>Honest read: we can <b>steer</b> the answer in one setting. A monitor that <b>corrects</b> a liar is not demonstrated — that's the honest boundary of a course project.</span></div>`,
      anchor: { search: "Causal-intervention targets", page: 6, frac: 0.2, lift: 150 },
      mark: { search: "Causal-intervention targets", up: 12, h: 26 },
      notes: "<p>对照原论文 Table 2 的 NIE 目标值：我们的效应量小，归因于单一固定强度——原论文附录同款警告。</p><p>但方向性结论成立：期中的“读”读到的不是影子。</p><p>坦诚边界：能转向 ≠ 能纠正。</p>",
    },
    {
      kicker: "Reproduction B",
      title: "A model <span class='em'>trained to hide</span>",
      html: `
        <ul class="icon-bullets">
          <li>${IC.tag}<span><b>Taboo adapters</b> on Gemma-2-9B-it: the model knows a secret word — <b>gold · moon · cloud</b> — uses it to answer, and never utters it</span></li>
          <li>${IC.lens}<span>We interrogate with <b>8 hint questions</b>. The hints are correct. The word never appears in the text</span></li>
          <li>${IC.layers}<span><b>Logit lens</b> at all 42 layers: decode each layer's hidden state and rank the secret word in its next-token distribution</span></li>
        </ul>
        <div class="say-quote">
          <div class="q-label">taboo-moon, asked for its word</div>
          <div class="q-text">“This word is often associated with werewolves and tides, and it's the only natural satellite of our planet.”</div>
          <div class="q-foot">a perfect hint — the word <b>moon</b> appears nowhere in it</div>
        </div>`,
      anchor: { search: "reading a secret the model never says", page: 5, frac: 0.2 },
      mark: { search: "reading a secret the model never says", up: 12, h: 17 },
      notes: "<p>主线一登场：实验室版欺诈模型。它知道、它用、它不说。</p><p>念一遍 moon 的回答，停一拍——天衣无缝的暗示，字面上没有 moon。</p><p>问题：这句话它“藏”在哪一层？</p>",
    },
    {
      kicker: "Where the secret lives",
      title: "Mid-stack, the word is <span class='em'>rank one</span>",
      html: `
        <figure class="fig-card">
          <img src="assets/taboo_logit_lens.png" alt="Logit lens heatmap: secret word rank per layer for taboo adapters vs base">
          <figcaption>log10 mean rank per layer · fraction of prompts with the word in top-5</figcaption>
        </figure>
        <ul class="bullets">
          <li><b>moon</b>: top-5 on all 8 prompts at <b>layers 7–15</b>, mean rank = 1 at layer 11</li>
          <li><b>gold</b>: 5/8 prompts at layers 7–10 · <b>cloud</b>: weaker and later, around layer 29</li>
          <li><b>base model</b>: never — mean rank ~4,000–6,000 <span class="dim">(the secret is trained in, not universal)</span></li>
        </ul>
        <div class="evidence-hint">${IC.mark} highlighted in the paper: the heatmap</div>`,
      anchor: { search: "Where the secret lives", page: 8, frac: 0.3, lift: 240 },
      mark: { search: "Where the secret lives", up: 12, h: 30 },
      notes: "<p>这是第一次演讲“哪一层撒谎”的正式答案：第 7–15 层，第 11 层排到第 1。</p><p>对照组要强调：base 模型同 prompt 全程 4–6 千名——信号是微调出来的，不是 logit lens 的幻觉。</p>",
    },
    {
      kicker: "The monitor",
      title: "One number: <span class='em'>did it hide something?</span>",
      html: `
        <figure class="fig-card small">
          <img src="assets/monitor_demo.png" alt="Hidden-intent monitor demo: rank trajectory and verdict badge">
          <figcaption>the offline monitor — pick a suspect, pick a question, read the verdict</figcaption>
        </figure>
        <ul class="bullets">
          <li><b>Monitor score</b> = share of 42 layers with the secret word in top-5 — <b>the output text is never consulted</b></li>
          <li>Verdict: <b>DETECTED</b> at score ≥ 25%, or a sustained top-5 run ≥ 4 layers</li>
          <li>Flags <b>moon 8/8 · gold 5/8 · cloud 3/8</b> — base model <b>0/8</b></li>
        </ul>
        <div class="evidence-hint">${IC.mark} live demo: <b>monitor.html</b> — we drive it on stage</div>`,
      anchor: { search: "From reading to monitoring", page: 6, frac: 0.2 },
      mark: { search: "From reading to monitoring", up: 12, h: 17 },
      notes: "<p>现场切到 monitor.html：默认 moon 已选中，点两个 prompt 看轨迹；再选 cloud、点 “Give me three clues”(prompt 5) 看 28–38 的晚期层带和 DETECTED。</p><p>再点 base 对照组（页面底部汇总表 0%）。</p><p>点题：监控器不读文字，只读隐状态——判断+置信度，零生成。</p>",
    },
    {
      kicker: "Honest limits",
      title: "What the monitor <span class='em'>can't</span> do yet",
      html: `
        <ul class="icon-bullets">
          <li>${IC.lens}<span><b>White-box only</b> — needs weights and activations; closed APIs are out of reach</span></li>
          <li>${IC.text}<span><b>Template statements</b> — natural lies are messier than templates; truth geometry is richer than one direction</span></li>
          <li>${IC.brain}<span><b>One model, one scale</b> — 13B and 9B; other families may draw the geometry differently</span></li>
          <li>${IC.split}<span><b>Steering ≠ control</b> — we flip answers in one setting; a monitor that corrects a liar is not demonstrated</span></li>
        </ul>`,
      anchor: { search: "Discussion and limitations", page: 6, frac: 0.3 },
      mark: { search: "steering, not yet control", up: 12, h: 17 },
      notes: "<p>四条局限各一句，自信地讲。第四条回收干预页的坦诚边界。</p><p>论文里这段在 Discussion，橙框标在 “steering, not yet control”。</p>",
    },
    {
      kicker: "Where this points",
      title: "A judge that <span class='em'>never sleeps</span>",
      html: `
        <ul class="icon-bullets">
          <li>${IC.tag}<span><b>Label-free</b> — no dataset of “deceptive intent” will ever exist; the label-free probe survived every transfer test</span></li>
          <li>${IC.layers}<span><b>Mid-stack</b> — sit where truth is most readable, and where the secret actually surfaces</span></li>
          <li>${IC.shield}<span><b>Generation-free</b> — a verdict and a confidence, cheap enough to run on every forward pass</span></li>
        </ul>
        <div class="risk-card">${IC.brain}<span>Reasoning is moving off the page — into looped layers and hidden states. Reading activations may soon be the <b>only audit channel left</b>. The model knows — and now, something is always watching. <b>Thank you.</b></span></div>`,
      anchor: { search: "Where this points", page: 6, frac: 0.4 },
      mark: { search: "Where this points", up: 12, h: 17 },
      notes: "<p>收尾三原则呼应全场：无标签（期中期中 CCS）、中层（逐层曲线+Taboo）、只判断不生成（第一次演讲 Jev 主线）。</p><p>最后一句放慢：The model knows — and now, something is always watching. 鞠躬。</p>",
    },
  ];

  const N = SCENES.length;

  /* ── dom handles ───────────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);
  const elBody = document.body;
  const elWindow = $("paper-window");
  const elPages = $("paper-pages");
  const elLoading = $("paper-loading");
  const elLayer = $("scene-layer");
  const elContent = $("scene-content");
  const elFill = $("progressfill");
  const elCounter = $("counter");
  const elNotes = $("notes-panel");
  const elNotesBody = $("notes-body");
  const elNotesScene = $("notes-scene");

  const elMarker = document.createElement("div");
  elMarker.id = "anchor-marker";

  /* ── pdf state ─────────────────────────────────────────────── */
  let pdf = null;
  let pageInfos = []; // { page, scale, cssW, cssH, top, canvas, items:[{str,x,y,w}] }
  let pdfReady = false;
  let renderedW = 0; // visible width the pages are currently rendered for
  // horizontal crop: fractions of page width cut from left/right so only
  // the text column (+ padding) shows. Computed from page 1's text layer;
  // fallback fits NeurIPS 5.5in text on 8.5in paper with ~5% padding.
  let cropL = 0.126, cropR = 0.874;

  /* ── scene state ───────────────────────────────────────────── */
  let current = 0;
  let scrollAnim = null;
  let renderToken = 0;

  /* ────────────────────────────────────────────────────────────
     PDF loading & rendering
     ──────────────────────────────────────────────────────────── */
  pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
  // On file:// the worker cannot load; pdf.js falls back to the
  // "fake worker" on the main thread — fine for a small document.

  function pdfBytes() {
    const bin = atob(PAPER_PDF_BASE64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function targetCssWidth() {
    return Math.round(window.innerWidth * 0.29);
  }

  async function loadPdf() {
    try {
      pdf = await pdfjsLib.getDocument({ data: pdfBytes() }).promise;
    } catch (err) {
      elLoading.querySelector(".loading-text").textContent =
        "could not load embedded paper: " + err.message;
      return;
    }
    await computeCrop();
    await renderAllPages(targetCssWidth());
    elLoading.style.display = "none";
    pdfReady = true;
    syncPaper(SCENES[current], { instant: true });
    window.__ready = true; // headless screenshot hook
  }

  /* text-column x-bounds from page 1, as fractions of page width,
     padded by ~5% of page width on each side */
  async function computeCrop() {
    try {
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      let left = Infinity, right = -Infinity;
      for (const it of tc.items) {
        const w = it.width || 0;
        if (w > 1) {
          left = Math.min(left, it.transform[4]);
          right = Math.max(right, it.transform[4] + w);
        }
      }
      if (isFinite(left) && right > left) {
        cropL = Math.max(0, Math.min(0.3, left / base.width - 0.05));
        cropR = Math.min(1, Math.max(0.7, right / base.width + 0.05));
      }
    } catch (e) { /* keep fallback crop */ }
  }

  /* Render every page and compute a synthetic layout (top offsets)
     so scroll/marker math never reads the DOM mid-transition.
     visibleW is the cropped window width; the canvas itself is wider
     and sits inside an overflow-hidden slice with a negative left offset. */
  async function renderAllPages(visibleW) {
    const tok = ++renderToken;
    elPages.innerHTML = "";
    pageInfos = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = visibleW / (cropR - cropL); // full-page canvas width
    const offX = cropL * cssW;               // hidden left strip width
    let top = 0;

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const scale = cssW / base.width;
      const viewport = page.getViewport({ scale: scale * dpr });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = cssW + "px";
      canvas.style.left = -offX + "px";

      const cssH = cssW * (base.height / base.width);
      const slice = document.createElement("div");
      slice.className = "page-slice";
      slice.style.height = cssH + "px";
      slice.appendChild(canvas);
      elPages.appendChild(slice);

      await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport: viewport,
      }).promise;
      if (tok !== renderToken) return; // superseded mid-render

      const cssVp = page.getViewport({ scale });
      let items = [];
      try {
        const tc = await page.getTextContent();
        items = tc.items.map((it) => {
          const [x, y] = cssVp.convertToViewportPoint(it.transform[4], it.transform[5]);
          return { str: it.str, x, y, w: (it.width || 0) * scale };
        });
      } catch (e) { /* text layer optional */ }

      pageInfos.push({ page, scale, cssW, cssH, top, canvas, items });
      top += cssH + 1; // 1px border between pages
    }
    elPages.appendChild(elMarker);
    renderedW = visibleW;
  }

  /* ────────────────────────────────────────────────────────────
     Anchor resolution: whitespace-flexible regex over each page's
     raw concatenated text items (PDF.js splits headings into
     "1", " ", "Introduction"). Reflow-safe: no hardcoded offsets.
     ──────────────────────────────────────────────────────────── */
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function searchPages(needle) {
    const flex = escapeRe(needle.trim()).replace(/\s+/g, "\\s+");
    for (const flags of ["", "i"]) { // case-sensitive first
      const re = new RegExp(flex, flags);
      for (const info of pageInfos) {
        let joined = "";
        const starts = [];
        for (const it of info.items) {
          starts.push(joined.length);
          joined += it.str;
        }
        const m = re.exec(joined);
        if (m) {
          let k = 0;
          while (k + 1 < starts.length && starts[k + 1] <= m.index) k++;
          return { info, y: info.items[k].y };
        }
      }
    }
    return null;
  }

  function findAnchor(a) {
    if (a.search) {
      const hit = searchPages(a.search);
      if (hit) return hit;
    }
    const info = pageInfos[Math.min(a.page, pageInfos.length) - 1];
    if (!info) return null;
    return { info, frac: a.frac };
  }

  function scrollTargetFor(scene) {
    const found = findAnchor(scene.anchor);
    if (!found) return 0;
    const { info, frac } = found;
    const y = frac != null ? frac * info.cssH : found.y;
    // lift: pull the view up so the figure *above* a caption anchor is visible
    const top = info.top + y - 56 - (scene.anchor.lift || 0);
    const winH = elWindow.clientHeight || window.innerHeight * 0.78;
    const max = Math.max(0, pageInfos.reduce((t, p) => t + p.cssH + 1, 0) - winH);
    return Math.max(0, Math.min(top, max));
  }

  /* ── highlight marker ──────────────────────────────────────── */
  function placeMarker(scene) {
    const mk = scene.mark;
    if (!mk || !pageInfos.length) {
      elMarker.className = "";
      return;
    }
    const hit = searchPages(mk.search);
    if (!hit) { elMarker.className = ""; return; } // never guess a position
    const { info, y } = hit;

    // text-column bounds from this page's items, shifted into the
    // cropped (visible) coordinate system
    let left = Infinity, right = -Infinity;
    for (const it of info.items) {
      if (it.w > 2) {
        left = Math.min(left, it.x);
        right = Math.max(right, it.x + it.w);
      }
    }
    if (!isFinite(left)) { elMarker.className = ""; return; }

    const offX = cropL * info.cssW; // hidden left strip width
    const padX = Math.max(6, 8 * info.scale);
    elMarker.style.left = left - offX - padX + "px";
    elMarker.style.width = right - left + padX * 2 + "px";
    elMarker.style.top = info.top + y - mk.up * info.scale + "px";
    elMarker.style.height = mk.h * info.scale + "px";
    elMarker.className = "show";
  }

  /* smooth-scroll the paper window, ~800ms ease-in-out */
  function scrollWindowTo(target, instant) {
    if (scrollAnim) cancelAnimationFrame(scrollAnim);
    const start = elWindow.scrollTop;
    const delta = target - start;
    if (instant || Math.abs(delta) < 2) {
      elWindow.scrollTop = target;
      return;
    }
    const dur = 800;
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      elWindow.scrollTop = start + delta * ease(t);
      if (t < 1) scrollAnim = requestAnimationFrame(step);
      else scrollAnim = null;
    };
    scrollAnim = requestAnimationFrame(step);
  }

  /* re-render only if the target width changed (resize), then scroll + mark */
  async function syncPaper(scene, opts) {
    if (!pdfReady) return;
    const w = targetCssWidth();
    if (w !== renderedW) await renderAllPages(w);
    scrollWindowTo(scrollTargetFor(scene), opts && opts.instant);
    placeMarker(scene);
  }

  /* ────────────────────────────────────────────────────────────
     Scene rendering
     ──────────────────────────────────────────────────────────── */
  function sceneHtml(s, idx) {
    return `<div class="kicker">${s.kicker} — ${idx + 1}/${N}</div>
            <div class="scene-title">${s.title}</div>
            ${s.html || ""}`;
  }

  function swapContent(idx, instant) {
    const html = sceneHtml(SCENES[idx], idx);
    if (instant) {
      elContent.innerHTML = html;
      return;
    }
    elContent.classList.add("fading");
    setTimeout(() => {
      elContent.innerHTML = html;
      elContent.classList.remove("fading");
    }, 200); // half of the 400ms crossfade
  }

  function updateChrome(idx) {
    elFill.style.width = ((idx + 1) / N) * 100 + "%";
    elCounter.innerHTML = `<b>${idx + 1}</b> / ${N}`;
    elNotesScene.textContent = `场景 ${idx + 1}/${N}`;
    elNotesBody.innerHTML = SCENES[idx].notes;
    elBody.classList.toggle("paperless", !!SCENES[idx].paperless);
  }

  /* ────────────────────────────────────────────────────────────
     Navigation
     ──────────────────────────────────────────────────────────── */
  function goTo(idx, opts) {
    opts = opts || {};
    idx = Math.max(0, Math.min(N - 1, idx));
    current = idx;
    const scene = SCENES[idx];
    swapContent(idx, opts.instant);
    updateChrome(idx);
    syncPaper(scene, opts);
    const hash = "#scene=" + (idx + 1);
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }

  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
      e.preventDefault(); next();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault(); prev();
    } else if (e.key === "Home") {
      e.preventDefault(); goTo(0);
    } else if (e.key === "End") {
      e.preventDefault(); goTo(N - 1);
    } else if (e.key === "s" || e.key === "S") {
      elNotes.classList.toggle("open");
    } else if (e.key === "f" || e.key === "F") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  $("next-btn").addEventListener("click", next);
  $("prev-btn").addEventListener("click", prev);

  window.addEventListener("hashchange", () => {
    const m = location.hash.match(/scene=(\d+)/);
    if (m) goTo(parseInt(m[1], 10) - 1);
  });

  /* re-render at the new width on resize (debounced) */
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!pdfReady) return;
      renderedW = 0; // force re-render
      syncPaper(SCENES[current], { instant: true });
    }, 300);
  });

  /* ── boot ──────────────────────────────────────────────────── */
  (function boot() {
    const m = location.hash.match(/scene=(\d+)/);
    if (m) current = Math.max(0, Math.min(N - 1, parseInt(m[1], 10) - 1));
    if (/notes=1/.test(location.hash)) elNotes.classList.add("open");
    goTo(current, { instant: true }); // paint the scene immediately
    loadPdf();
    // enable transitions only after the first paint, so deep links
    // land fully formed
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        elBody.classList.remove("boot");
      }));
  })();
})();
