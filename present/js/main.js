/* ─────────────────────────────────────────────────────────────
   Models Know, But Don't Always Say — presentation engine
   Renders ../paper/paper.pdf (embedded base64) into the central
   "window" and auto-scrolls it to a per-scene anchor.
   ───────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  /* ── scene definitions ─────────────────────────────────────── */
  // anchor: {search} is looked up in the PDF text layer; if the search
  // fails we fall back to {page (1-based), frac (fraction down the page)}.
  const SCENES = [
    {
      kicker: "CSI-435/535 · Course talk",
      title: 'Models Know, But Don\'t <span class="em">Always Say</span>',
      sub: "Reading a language model's mind with tools from class",
      meta: "Initial presentation · Fall 2026",
      anchor: { search: null, page: 1, frac: 0 },
      notes: "<p>开场一句话：模型知道，但不一定说。</p><p>我们复现两篇已发表的工作，全程只用课上讲过的工具。</p>",
    },
    {
      kicker: "The gap",
      title: "What a model <span class='em'>says</span> ≠ what it <span class='em'>believes</span>",
      bullets: [
        "The output is a <b>sampled utterance</b>, not a read-out of internal state",
        "Models can assert falsehoods <b>fluently</b>",
        "Recent work trains models to <b>know a secret word yet never say it</b>",
        "<span class='dim'>Question:</span> can we read the judgment directly off the <b>activations</b>?",
      ],
      anchor: { search: "1 Introduction", page: 1, frac: 0.62 },
      notes: "<p>输出不等于内部状态；模型会流利说假话；Taboo 模型被训练成知道但不说。</p><p>核心问题是绕过输出直接读激活——这对 AI 安全监控很重要。</p>",
    },
    {
      kicker: "Tools",
      title: "Activations and <span class='em'>probes</span>",
      bullets: [
        "Residual stream = one <b>d-dimensional vector per token</b> after each block",
        "A probe is a <b>tiny classifier</b> (e.g. logistic regression) on those vectors",
        "If a linear probe succeeds, the property is <b>linearly represented</b> — it's “there”, whether or not the model says it",
      ],
      anchor: { search: "2 Background", page: 2, frac: 0.05 },
      notes: "<p>残差流是模型的草稿纸；探针是小分类器。</p><p>线性可预测 ⇒ 性质就在表示里。</p>",
    },
    {
      kicker: "One story",
      title: "Two published results, <span class='em'>one story</span>",
      cards: [
        {
          tag: "A · main",
          title: "The Geometry of Truth",
          venue: "Marks & Tegmark · COLM 2024",
          desc: "Two clusters under PCA · probes generalize across datasets · interventions flip answers",
        },
        {
          tag: "B · secondary",
          title: "Eliciting Secret Knowledge",
          venue: "Cywiński et al. · 2025",
          desc: "Taboo models hide a secret word; the logit lens reads it straight off the layers",
          secondary: true,
        },
      ],
      anchor: { search: "Reproduction A (main)", page: 1, frac: 0.72 },
      notes: "<p>两篇都有公开代码和模型；我们亲手复现并讲清楚。</p>",
    },
    {
      kicker: "Reproduction A · setup",
      title: "Data: simple <span class='em'>true/false</span> statements",
      stmts: [
        { text: "“The city of Krasnodar is in Russia.”", tag: "true", cls: "t" },
        { text: "“The city of Krasnodar is in South Africa.”", tag: "false", cls: "f", false: true },
      ],
      bullets: [
        "Datasets: <b>cities</b> · <b>neg_cities</b> · <b>sp_en_trans</b>",
        "Protocol: raw statements · <b>last token</b> (the period) · mid-layer",
        "<span class='dim'>No QA formatting, no few-shot</span>",
      ],
      anchor: { search: "3.1 Setup", page: 2, frac: 0.55 },
      notes: "<p>读两条例子；强调协议是原文设定，测的是模型自己的表示。</p>",
    },
    {
      kicker: "Result 1",
      title: "True and false <span class='em'>separate</span> — before any training",
      hero: true,
      anchor: { search: "Two clusters", page: 3, frac: 0.08 },
      notes: "<p>每个点是一条陈述的激活；PCA 不知道标签却分成两团。</p><p>这就是“模型知道”的直接证据。</p>",
    },
    {
      kicker: "Connections",
      title: "Exactly the <span class='em'>course toolbox</span>",
      bullets: [
        "<b>PCA</b> = eigendecomposition of the activation covariance",
        "<b>LR probe</b> = logistic regression, as in class",
        "Mean-difference probe <b>θ = μ⁺ − μ⁻</b> = the Fisher LDA idea",
        "<b>Generalization</b> = train/test split across topics",
      ],
      anchor: { search: "Probes", page: 2, frac: 0.38 },
      notes: "<p>点明和课上的 PCA、逻辑回归、Fisher 判别一一对应。</p>",
    },
    {
      kicker: "Next",
      title: "Plan",
      bullets: [
        "<b>Now</b> — activations running on the cluster; first figure done",
        "<b>Midterm</b> — LR / MM / CCS probes · generalization matrix · which layer",
        "<b>Final</b> — causal intervention + Taboo secret words + logit lens",
        "<span class='dim'>Risk: all reproductions, inference-only, robust schedule</span>",
      ],
      anchor: { search: "4 Reproduction B", page: 3, frac: 0.55 },
      notes: "<p>按节奏讲完计划；强调全是复现、只需推理、风险低。</p>",
    },
  ];

  const N = SCENES.length;

  /* ── dom handles ───────────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);
  const elWindow = $("paper-window");
  const elPages = $("paper-pages");
  const elLoading = $("paper-loading");
  const elContent = $("scene-content");
  const elFill = $("progressfill");
  const elCounter = $("counter");
  const elNotes = $("notes-panel");
  const elNotesBody = $("notes-body");
  const elNotesScene = $("notes-scene");
  const elHero = $("hero-panel");
  const elHeroImg = $("hero-img");
  const elHeroPh = $("hero-placeholder");

  /* ── pdf state ─────────────────────────────────────────────── */
  let pdf = null;
  let pageInfos = []; // { page, viewport, canvas, textItems }
  let pdfReady = false;
  let heroImgOk = null; // null = unknown yet

  /* ── scene state ───────────────────────────────────────────── */
  let current = 0;
  let scrollAnim = null;

  /* ────────────────────────────────────────────────────────────
     PDF loading & rendering
     ──────────────────────────────────────────────────────────── */
  pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
  // On file:// the worker cannot load; pdf.js then falls back to the
  // "fake worker" on the main thread — fine for a 4-page document.
  // disableWorker is a belt-and-braces hint for old builds.
  try { pdfjsLib.disableWorker = false; } catch (e) { /* ignore */ }

  function pdfBytes() {
    const bin = atob(PAPER_PDF_BASE64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function loadPdf() {
    try {
      pdf = await pdfjsLib.getDocument({ data: pdfBytes() }).promise;
    } catch (err) {
      elLoading.querySelector(".loading-text").textContent =
        "could not load embedded paper: " + err.message;
      return;
    }
    await renderAllPages();
    elLoading.style.display = "none";
    pdfReady = true;
    goTo(current, { instant: true });
  }

  async function renderAllPages() {
    elPages.innerHTML = "";
    pageInfos = [];
    const cssWidth = elWindow.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const scale = cssWidth / base.width;
      const viewport = page.getViewport({ scale: scale * dpr });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = "100%";
      elPages.appendChild(canvas);
      await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport: viewport,
      }).promise;

      // cache text items for anchor search
      let items = [];
      try {
        const tc = await page.getTextContent();
        items = tc.items.map((it) => ({
          str: it.str,
          // position via the css-scale viewport so y maps to displayed pixels
          xy: page
            .getViewport({ scale })
            .convertToViewportPoint(it.transform[4], it.transform[5]),
        }));
      } catch (e) { /* text layer optional */ }

      pageInfos.push({ page, viewport, canvas, items, scale });
    }
  }

  /* ────────────────────────────────────────────────────────────
     Anchor resolution
     ──────────────────────────────────────────────────────────── */
  // Whitespace-flexible regex search over each page's raw concatenated
  // text items (PDF.js splits headings into "1", " ", "Introduction",
  // so naive joins produce double spaces). Returns the y of the item
  // where the match starts, in css pixels from the page top.
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function searchPage(info, re) {
    let joined = "";
    const starts = [];
    for (const it of info.items) {
      starts.push(joined.length);
      joined += it.str;
    }
    const m = re.exec(joined);
    if (!m) return null;
    let k = 0;
    while (k + 1 < starts.length && starts[k + 1] <= m.index) k++;
    return info.items[k].xy[1];
  }

  function findAnchor(scene) {
    const a = scene.anchor;
    if (a.search) {
      const flex = escapeRe(a.search.trim()).replace(/\s+/g, "\\s+");
      for (const flags of ["", "i"]) { // case-sensitive first
        const re = new RegExp(flex, flags);
        for (const info of pageInfos) {
          const y = searchPage(info, re);
          if (y != null) return { info, y };
        }
      }
    }
    // fallback: manual {page, frac} — frac is resolved in scrollTargetFor
    const info = pageInfos[Math.min(a.page, pageInfos.length) - 1];
    if (!info) return null;
    return { info, frac: a.frac };
  }

  function scrollTargetFor(scene) {
    const found = findAnchor(scene);
    if (!found) return 0;
    const { info, frac } = found;
    const displayedH = info.canvas.clientHeight ||
      (info.canvas.height / Math.min(window.devicePixelRatio || 1, 2));
    const y = frac != null ? frac * displayedH : found.y;
    const top = info.canvas.offsetTop + y - 56; // sit slightly below the window top
    const max = elWindow.scrollHeight - elWindow.clientHeight;
    return Math.max(0, Math.min(top, max));
  }

  /* smooth-scroll the paper window, ~600ms ease-in-out */
  function scrollWindowTo(target, instant) {
    if (scrollAnim) cancelAnimationFrame(scrollAnim);
    const start = elWindow.scrollTop;
    const delta = target - start;
    if (instant || Math.abs(delta) < 2) {
      elWindow.scrollTop = target;
      return;
    }
    const dur = 600;
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

  /* ────────────────────────────────────────────────────────────
     Scene rendering
     ──────────────────────────────────────────────────────────── */
  function sceneHtml(s, idx) {
    let h = `<div class="kicker">${s.kicker} — ${idx + 1}/${N}</div>`;
    h += `<div class="scene-title">${s.title}</div>`;
    if (s.sub) h += `<div class="scene-sub">${s.sub}</div>`;
    if (s.cards) {
      for (const c of s.cards) {
        h += `<div class="paper-card${c.secondary ? " secondary" : ""}">
                <div class="pc-tag">${c.tag}</div>
                <div class="pc-title">${c.title}</div>
                <div class="pc-venue">${c.venue}</div>
                <div class="pc-desc">${c.desc}</div>
              </div>`;
      }
    }
    if (s.stmts) {
      for (const st of s.stmts) {
        h += `<div class="stmt${st.false ? " false" : ""}">${st.text}
                <span class="tag ${st.cls}">${st.tag}</span></div>`;
      }
    }
    if (s.bullets) {
      h += '<ul class="bullets">';
      for (const b of s.bullets) h += `<li>${b}</li>`;
      h += "</ul>";
    }
    if (s.meta) h += `<div class="scene-meta">${s.meta}</div>`;
    return h;
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
    elHero.classList.toggle("hidden", !SCENES[idx].hero);
    if (SCENES[idx].hero) applyHeroState();
  }

  function applyHeroState() {
    if (heroImgOk === true) {
      elHeroImg.classList.remove("hidden");
      elHeroPh.classList.add("hidden");
    } else if (heroImgOk === false) {
      elHeroImg.classList.add("hidden");
      elHeroPh.classList.remove("hidden");
    }
  }

  // probe whether the figure file exists (file:// safe via Image events)
  (function probeHeroImage() {
    const img = new Image();
    img.onload = () => { heroImgOk = true; applyHeroState(); };
    img.onerror = () => { heroImgOk = false; applyHeroState(); };
    img.src = elHeroImg.getAttribute("src");
  })();

  /* ────────────────────────────────────────────────────────────
     Navigation
     ──────────────────────────────────────────────────────────── */
  function goTo(idx, opts) {
    opts = opts || {};
    idx = Math.max(0, Math.min(N - 1, idx));
    const changed = idx !== current;
    current = idx;
    swapContent(idx, opts.instant);
    updateChrome(idx);
    if (pdfReady && (changed || opts.instant || opts.rescroll)) {
      scrollWindowTo(scrollTargetFor(SCENES[idx]), opts.instant);
    }
    const hash = "#scene=" + (idx + 1);
    if (location.hash !== hash) history.replaceState(null, "", hash);
    // enable hero-panel transitions only after the first paint,
    // so the boot state (e.g. #scene=6) appears without a fade
    if (!elHero.classList.contains("animated")) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => elHero.classList.add("animated")));
    }
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

  /* re-render pages at the new width on resize (debounced) */
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(async () => {
      if (!pdf) return;
      await renderAllPages();
      scrollWindowTo(scrollTargetFor(SCENES[current]), true);
    }, 300);
  });

  /* ── boot ──────────────────────────────────────────────────── */
  (function boot() {
    const m = location.hash.match(/scene=(\d+)/);
    if (m) current = Math.max(0, Math.min(N - 1, parseInt(m[1], 10) - 1));
    if (/notes=1/.test(location.hash)) elNotes.classList.add("open");
    goTo(current, { instant: true }); // paint scene text immediately
    loadPdf();
  })();
})();
