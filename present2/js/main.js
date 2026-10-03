/* ─────────────────────────────────────────────────────────────
   The Probes Generalize — Mostly — midterm presentation engine
   Same stage as talk 1: content on the left, the paper sits still
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
      kicker: "CSI-435/535 · Midterm presentation",
      title: 'The Probes <span class="em uline">Generalize</span> — Mostly',
      html: `<div class="scene-sub">Where a truth direction travels, where it breaks, and how we know it's real</div>
             <div class="scene-meta">Midterm · Fall 2026 · Group 8</div>`,
      anchor: { search: null, page: 1, frac: 0 },
      paperless: true,
      notes: "<p>开场一句话：上次我们在激活里找到了真理方向，这次回答三个问题——它能迁移吗？在哪断？怎么证明它是真的？</p><p>右侧论文稍后出现。</p>",
    },
    {
      kicker: "Last time",
      title: "Two clusters, <span class='em'>one direction</span>",
      html: `
        <figure class="fig-card small">
          <img src="assets/pca_two_clusters.png" alt="PCA: true and false statements form two clusters">
          <figcaption>talk 1 recap — LLaMA-2-13B, layer 14, PCA without labels</figcaption>
        </figure>
        <ul class="bullets">
          <li>True and false statements <b>separate under PCA</b> — no labels involved</li>
          <li>A linear probe reads the direction: <b>LR · MM · CCS</b></li>
          <li>This time: does the direction <b>travel</b>? 11 datasets, 12 layers</li>
        </ul>`,
      anchor: { search: "Two clusters", page: 3, frac: 0.08 },
      paperless: true,
      notes: "<p>30 秒回顾：两团分离 = 模型内部线性可读。今天的主线：迁移。</p>",
    },
    {
      kicker: "Tools, briefly",
      title: "Three ways to draw <span class='em'>the same line</span>",
      html: `
        <div class="f-grid">
          <div class="f-card">
            <div class="f-head"><span class="f-abbr">LR</span><span class="f-full">logistic regression</span></div>
            <div class="f-formula">p = σ(w<sup>⊤</sup>x)</div>
            <div class="f-plain">the classifier from class — <b>trained</b> on labeled statements.</div>
          </div>
          <div class="f-card">
            <div class="f-head"><span class="f-abbr">MM</span><span class="f-full">mass-mean</span></div>
            <div class="f-formula">θ = μ<sup>+</sup> − μ<sup>−</sup></div>
            <div class="f-plain">false-cloud center → true-cloud center. <b>Closed form</b>, Fisher's cousin.</div>
          </div>
          <div class="f-card">
            <div class="f-head"><span class="f-abbr">CCS</span><span class="f-full">contrast-consistent search</span></div>
            <div class="f-formula">min<sub>θ</sub> Σ (p(x<sup>+</sup>) + p(x<sup>−</sup>) − 1)<sup>2</sup></div>
            <div class="f-plain">a statement and its negation must come out opposite — <b>no labels at all</b>.</div>
          </div>
          <div class="f-card wide">
            <div class="f-plain">All three are bias-free on mean-centered activations. The difference is not the line — it is <b>who needs labels to find it</b>.</div>
          </div>
        </div>`,
      anchor: { search: "Probes.", page: 2, frac: 0.05 },
      mark: { search: "Probes.", up: 12, h: 56 },
      notes: "<p>三种探针一句话各自带过，重点落在 CCS：它不需要标签。这句话后面要考。</p>",
    },
    {
      kicker: "Result · generalization",
      title: "Trained on one topic, <span class='em'>tested on eleven</span>",
      html: `
        <figure class="fig-card">
          <img src="assets/generalization_matrix.png" alt="Generalization matrix for LR, MM, CCS probes">
          <figcaption>rows = training set · columns = test set · green = the direction travels</figcaption>
        </figure>
        <ul class="bullets">
          <li><b>larger_than+smaller_than → sp_en_trans 0.97</b> — cross-topic, cross-language <span class="dim">(original paper: &gt;0.95 ✓)</span></li>
          <li>Same-dataset held-out: LR 0.99 · MM 1.00 · CCS 0.99 — all three find the line</li>
          <li>The failures are <b>not random</b> — they cluster in exactly one place →</li>
        </ul>
        <div class="evidence-hint">${IC.mark} highlighted in the paper: the Fig. 3 matrix</div>`,
      anchor: { search: "Do truth probes generalize?", page: 3, frac: 0.3, lift: 260 },
      mark: { search: "Do truth probes generalize?", up: 12, h: 30 },
      notes: "<p>核心图，给两分钟。读法：行是训练集，列是测试集，越绿越能迁移。</p><p>亮点：比较关系训练、迁移到西英翻译 0.97，跨话题跨语言。</p><p>收尾指向失败格：失败不是随机的——下一页。</p>",
    },
    {
      kicker: "The interesting failure",
      title: "Negation <span class='em'>breaks</span> the direction",
      html: `
        <figure class="fig-card">
          <img src="assets/negation_split.png" alt="Probes trained on affirmative statements collapse on negated ones">
          <figcaption>trained on affirmative statements → tested on their negated twins</figcaption>
        </figure>
        <ul class="bullets">
          <li>LR trained on <b>cities</b>: 0.99 → <b>0.33</b> on neg_cities, <b>0.28</b> on neg_sp_en_trans</li>
          <li>MM is robust near home (0.77), collapses away from it (0.16)</li>
          <li>One direction per template family — <b>negation rotates it</b></li>
        </ul>`,
      anchor: { search: "The transfer failures live on negated statements", page: 4, frac: 0.2, lift: 240 },
      mark: { search: "The transfer failures live on negated statements", up: 12, h: 30 },
      notes: "<p>“有意思的发现”页。blue/green 两根矮柱：只在肯定句上训练的探针，碰到否定句就崩到随机以下。</p><p>解释一句：每个模板家族各有一条真理方向，否定把它转走了——所以不是“模型不知道”，是“探针没学到这个方向”。</p>",
    },
    {
      kicker: "The fix that needs no labels",
      title: "A monitor that <span class='em'>never saw a label</span>",
      html: `
        <figure class="fig-card">
          <img src="assets/ccs_vs_supervised.png" alt="CCS without labels tracks supervised probes across all datasets">
          <figcaption>all three trained on cities+neg_cities · CCS sees only statement/negation pairs</figcaption>
        </figure>
        <ul class="bullets">
          <li>CCS asks only: <b>a statement and its negation must come out opposite</b></li>
          <li>Matches the supervised probes on 10/11 datasets — <b>wins the hardest transfer</b> (neg_sp_en 0.97)</li>
          <li>Why we care: a hidden-intent monitor <b>won't have labels</b> for “intent”</li>
        </ul>`,
      anchor: { search: "A label-free monitor", page: 4, frac: 0.15, lift: 220 },
      mark: { search: "A label-free monitor", up: 12, h: 30 },
      notes: "<p>这页把 CCS 单独提出来：不加否定句进训练集也行——干脆不要标签。</p><p>琥珀色柱在最难的 neg_sp_en 上反超。点一句安全含义：真到监控“隐藏意图”那天，是没有标签可用的。</p>",
    },
    {
      kicker: "The control",
      title: "It's not in <span class='em'>the words</span>",
      html: `
        <figure class="fig-card">
          <img src="assets/text_baseline.png" alt="Text baseline at chance while activation probes separate easily">
          <figcaption>TF-IDF + LR on the raw statement text · identical 80/20 split</figcaption>
        </figure>
        <ul class="bullets">
          <li>Text baseline: <b>chance (0.45–0.52) on 10/11 datasets</b>; char 3–5-grams ≤ 0.55</li>
          <li>The one leak: larger_than 0.94 via digit tokens — and it <b>flips to 0.05</b> on smaller_than <span class="dim">(surface, not relation)</span></li>
          <li>Only the <b>pairing</b> carries the truth — and the pairing is invisible to bag-of-words</li>
        </ul>
        <div class="evidence-hint">${IC.mark} highlighted in the paper: the text-vs-model control</div>`,
      anchor: { search: "Reading the text vs", page: 5, frac: 0.2, lift: 240 },
      mark: { search: "Reading the text vs", up: 12, h: 30 },
      notes: "<p>控制实验页，回答“探针会不会只是认字”。</p><p>同 split 下纯文字分类器全面随机；字符级 n-gram 也一样。唯一的例外 larger_than 恰好证明规则：它学到的是数字表面方向，换 smaller_than 立刻翻成 0.05。</p><p>结论：探针读的是模型脑子里的东西，不是纸面上的字。</p>",
    },
    {
      kicker: "Where in the network",
      title: "The middle layers <span class='em'>know</span>",
      html: `
        <figure class="fig-card">
          <img src="assets/layer_sweep.png" alt="Probe accuracy by layer: mid-stack is most readable">
          <figcaption>LR / MM trained on cities+neg_cities at each of 12 layers</figcaption>
        </figure>
        <ul class="bullets">
          <li>Held-out accuracy <b>saturates from layer ~10</b></li>
          <li>Transfer peaks <b>mid-stack (10–20)</b>, decays toward the head</li>
          <li>This is why the original repo probes at <b>layer 14</b> <span class="dim">(dotted line)</span></li>
        </ul>`,
      anchor: { search: "Truth is most linearly accessible", page: 4, frac: 0.6, lift: 240 },
      mark: { search: "Truth is most linearly accessible", up: 12, h: 30 },
      notes: "<p>逐层页：中间层最线性可读，迁移也在中层见顶。给“在第几层撒谎”埋下伏笔——期末 Taboo 会回到这条曲线。</p>",
    },
    {
      kicker: "Honest limits",
      title: "What this <span class='em'>doesn't</span> buy us yet",
      html: `
        <ul class="icon-bullets">
          <li>${IC.lens}<span><b>White-box only</b> — needs weights and activations; closed APIs are out of reach</span></li>
          <li>${IC.text}<span><b>Template statements</b> — natural lies are messier than templates</span></li>
          <li>${IC.brain}<span><b>One model, one scale</b> — 13B; geometry differs across families</span></li>
          <li>${IC.split}<span><b>Classification ≠ causation</b> — a probe that reads a direction doesn't prove the model <b>uses</b> it</span></li>
        </ul>
        <div class="risk-card" style="margin-top:22px">${IC.shield}<span><b>So far this is read-only.</b> The final talk tests causality — and a model trained to hide.</span></div>`,
      anchor: { search: "Discussion and limitations", page: 6, frac: 0.3 },
      notes: "<p>坦诚页，四条局限各一句。最后一条直接过渡：光“读”不够，模型到底有没有在“用”这个方向？期末做因果实验。</p>",
    },
    {
      kicker: "Next",
      title: "From reading to <span class='em'>causing</span>",
      html: `
        <div class="timeline">
          <div class="tl-node now">
            <div class="tl-dot"></div>
            <div class="tl-when">Done · today</div>
            <div class="tl-what">reproduction + generalization<br><span class="dim">matrix · negation · CCS · text control · layers</span></div>
          </div>
          <div class="tl-node final">
            <div class="tl-dot"></div>
            <div class="tl-when">Final · Dec 7</div>
            <div class="tl-what">causality + hidden knowledge<br><span class="dim">push the direction, flip the answer · read the word the model never says</span></div>
          </div>
        </div>
        <div class="chips">
          <span class="chip">intervention: sign flip <span class="n">+0.12 → −0.09</span></span>
          <span class="chip">taboo: secret word <span class="n">top-5 @ layers 7–15</span></span>
        </div>`,
      anchor: { search: "pushing along the truth direction", page: 5, frac: 0.2 },
      mark: { search: "pushing along the truth direction", up: 12, h: 17 },
      notes: "<p>30 秒收尾：两个预告数字——干预能把 P(TRUE)−P(FALSE) 从 +0.12 按到 −0.09；Taboo 模型的秘密词在第 7–15 层排进前五。期末见。</p>",
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
