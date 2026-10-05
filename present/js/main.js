/* ─────────────────────────────────────────────────────────────
   Models Know, But Don't Always Say — presentation engine
   Content stage on the left; the paper sits still on the right.
   Only the paper's internal scroll and the amber highlight marker
   move. All paper positions resolve via text search (reflow-safe),
   with {page, frac} fallbacks. PDF is embedded base64 (paper_data.js).
   ───────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  /* ── inline SVG icons (offline, stroke-based) ──────────────── */
  const IC = {
    bubble: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16v10.5H9.5L4 20z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
    brain: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12c1-1.6 2.2-1.6 3.5 0s2.5 1.6 3.5 0M12 3.5v3M12 17.5v3"/></svg>',
    key: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M15 7l3 3M18 4l2 2"/></svg>',
    lens: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
    clusters: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="7" cy="8" r="1.6" fill="currentColor" stroke="none"/><circle cx="10" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="8.5" cy="11" r="1.6" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15" r="1.6" fill="#f5b942" stroke="none"/><circle cx="18.5" cy="13" r="1.6" fill="#f5b942" stroke="none"/><circle cx="17" cy="18" r="1.6" fill="#f5b942" stroke="none"/></svg>',
    lock: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none"/></svg>',
    lda: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="9" r="2.2"/><circle cx="17.5" cy="15" r="2.2" stroke="#f5b942"/><path d="M8.5 10.5l7 3"/></svg>',
    split: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16" stroke-dasharray="3 3"/><path d="M6.5 12h2M15.5 12h2"/></svg>',
    shield: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7.5 3v6c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V6z"/><path d="M9 12l2 2 4-4.5"/></svg>',
    mark: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z" opacity="0"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M4 6l3-2M20 6l-3-2"/></svg>',
  };

  /* scene 3: residual-stream tap diagram (portrait, for focus column) */
  const DIAGRAM_PROBE = `
  <svg viewBox="0 0 320 370" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arr" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
        <path d="M0 0L7 3.5L0 7z" fill="#6ee7ff"/>
      </marker>
    </defs>
    <rect x="55" y="12" width="210" height="52" rx="9" fill="rgba(110,231,255,0.05)" stroke="rgba(110,231,255,0.45)" stroke-width="1.3"/>
    <text x="160" y="32" text-anchor="middle" font-size="11.5" letter-spacing="2.5" fill="#93a0b8" font-family="-apple-system,Arial">TOKENS</text>
    <text x="160" y="52" text-anchor="middle" font-size="13.5" font-style="italic" fill="#e8edf6" font-family="Georgia,serif">“The city of … Russia .”</text>
    <path d="M160 64V84" stroke="#6ee7ff" stroke-width="1.6" marker-end="url(#arr)"/>
    <rect x="85" y="86" width="150" height="40" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(232,237,246,0.4)" stroke-width="1.3"/>
    <text x="160" y="111" text-anchor="middle" font-size="14" fill="#e8edf6" font-family="-apple-system,Arial">block 1</text>
    <path d="M160 126V142" stroke="#6ee7ff" stroke-width="1.6" marker-end="url(#arr)"/>
    <rect x="85" y="144" width="150" height="40" rx="8" fill="rgba(110,231,255,0.09)" stroke="#6ee7ff" stroke-width="1.6"/>
    <text x="160" y="169" text-anchor="middle" font-size="14" fill="#e8edf6" font-family="-apple-system,Arial">block 2</text>
    <path d="M235 164H282V124" stroke="#f5b942" stroke-width="1.6" stroke-dasharray="4 4" marker-end="url(#arr)"/>
    <text x="240" y="156" font-size="9.5" fill="#93a0b8" font-family="-apple-system,Arial">residual stream</text>
    <rect x="238" y="82" width="76" height="42" rx="8" fill="rgba(245,185,66,0.08)" stroke="#f5b942" stroke-width="1.4"/>
    <text x="276" y="99" text-anchor="middle" font-size="12" fill="#f5b942" font-family="-apple-system,Arial">linear</text>
    <text x="276" y="114" text-anchor="middle" font-size="12" fill="#f5b942" font-family="-apple-system,Arial">probe</text>
    <text x="276" y="70" text-anchor="middle" font-size="13.5" font-style="italic" fill="#f5b942" font-family="Georgia,serif">true / false?</text>
    <text x="160" y="208" text-anchor="middle" font-size="15" fill="#93a0b8" font-family="Georgia,serif">⋮</text>
    <rect x="85" y="216" width="150" height="40" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(232,237,246,0.4)" stroke-width="1.3"/>
    <text x="160" y="241" text-anchor="middle" font-size="14" fill="#e8edf6" font-family="-apple-system,Arial">block L</text>
    <path d="M160 256V272" stroke="#6ee7ff" stroke-width="1.6" marker-end="url(#arr)"/>
    <rect x="85" y="274" width="150" height="44" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(232,237,246,0.4)" stroke-width="1.3"/>
    <text x="160" y="293" text-anchor="middle" font-size="13" fill="#e8edf6" font-family="-apple-system,Arial">next-token</text>
    <text x="160" y="309" text-anchor="middle" font-size="13" fill="#e8edf6" font-family="-apple-system,Arial">head</text>
    <text x="160" y="348" text-anchor="middle" font-size="11.5" fill="#93a0b8" font-family="-apple-system,Arial">dashed: we tap the stream, not the output</text>
  </svg>`;

  /* scene 3: recurrent-depth (looped) transformer — the "why now" diagram */
  const DIAGRAM_ASTRA = `
  <svg viewBox="0 0 560 296" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arr2" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
        <path d="M0 0L7 3.5L0 7z" fill="#6ee7ff"/>
      </marker>
    </defs>
    <text x="10" y="20" font-size="10.5" letter-spacing="2" fill="#93a0b8" font-family="-apple-system,Arial">REPORTED ARCHITECTURE · GPT-6 ASTRA · “RECURRENT DEPTH”</text>
    <rect x="14" y="118" width="70" height="44" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(232,237,246,0.4)" stroke-width="1.3"/>
    <text x="49" y="145" text-anchor="middle" font-size="12.5" fill="#e8edf6" font-family="-apple-system,Arial">tokens</text>
    <path d="M84 140H108" stroke="#6ee7ff" stroke-width="1.6" marker-end="url(#arr2)"/>
    <rect x="110" y="110" width="76" height="60" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(232,237,246,0.4)" stroke-width="1.3"/>
    <text x="148" y="145" text-anchor="middle" font-size="12.5" fill="#e8edf6" font-family="-apple-system,Arial">block 1</text>
    <path d="M186 140H210" stroke="#6ee7ff" stroke-width="1.6" marker-end="url(#arr2)"/>
    <rect x="212" y="66" width="200" height="130" rx="12" fill="rgba(245,185,66,0.05)" stroke="#f5b942" stroke-width="1.4" stroke-dasharray="6 4"/>
    <text x="312" y="86" text-anchor="middle" font-size="10.5" letter-spacing="1.5" fill="#f5b942" font-family="-apple-system,Arial">LOOPED BLOCKS</text>
    <rect x="244" y="98" width="64" height="50" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(232,237,246,0.45)" stroke-width="1.3"/>
    <text x="276" y="127" text-anchor="middle" font-size="12.5" fill="#e8edf6" font-family="-apple-system,Arial">block k</text>
    <path d="M308 123h34a14 14 0 0014-14v0a14 14 0 00-14-14h-52" stroke="#f5b942" stroke-width="1.5" fill="none" marker-end="url(#arr2)"/>
    <text x="352" y="135" font-size="11" fill="#f5b942" font-family="-apple-system,Arial">× r loops</text>
    <text x="312" y="186" text-anchor="middle" font-size="10.5" fill="#93a0b8" font-family="-apple-system,Arial">same blocks, reused — compute stays in hidden states</text>
    <path d="M412 140H436" stroke="#6ee7ff" stroke-width="1.6" marker-end="url(#arr2)"/>
    <rect x="438" y="110" width="100" height="60" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(232,237,246,0.4)" stroke-width="1.3"/>
    <text x="488" y="134" text-anchor="middle" font-size="12.5" fill="#e8edf6" font-family="-apple-system,Arial">next-token</text>
    <text x="488" y="150" text-anchor="middle" font-size="12.5" fill="#e8edf6" font-family="-apple-system,Arial">head</text>
    <text x="488" y="196" text-anchor="middle" font-size="11" fill="#93a0b8" font-family="-apple-system,Arial">text out</text>
    <path d="M488 170v14" stroke="#6ee7ff" stroke-width="1.3" stroke-dasharray="3 3"/>
    <path d="M240 224h150" stroke="#f5b942" stroke-width="1.4" stroke-dasharray="4 4"/>
    <path d="M240 218v12M390 218v12" stroke="#f5b942" stroke-width="1.4"/>
    <text x="315" y="244" text-anchor="middle" font-size="11.5" fill="#f5b942" font-family="-apple-system,Arial">hidden computation — never in the CoT</text>
    <path d="M448 224h80" stroke="#6ee7ff" stroke-width="1.3" stroke-dasharray="4 4"/>
    <path d="M448 218v12M528 218v12" stroke="#6ee7ff" stroke-width="1.3"/>
    <text x="488" y="244" text-anchor="middle" font-size="11.5" fill="#93a0b8" font-family="-apple-system,Arial">CoT = summary</text>
    <text x="10" y="280" font-size="11" fill="#93a0b8" font-family="-apple-system,Arial">reading the output text is no longer enough — the loop is where semantics hide</text>
  </svg>`;

  /* scene 2: the plan in one picture — small monitor inside a big liar */
  const DIAGRAM_PLAN = `
  <svg viewBox="0 0 560 268" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrp" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
        <path d="M0 0L7 3.5L0 7z" fill="#6ee7ff"/>
      </marker>
      <marker id="arrg" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
        <path d="M0 0L7 3.5L0 7z" fill="#f5b942"/>
      </marker>
    </defs>
    <text x="14" y="18" font-size="10.5" letter-spacing="2" fill="#93a0b8" font-family="-apple-system,Arial">OPEN-SOURCE DECEPTIVE MODEL · TABOO · GEMMA-2-9B + LORA</text>
    <rect x="14" y="30" width="296" height="184" rx="12" fill="rgba(255,255,255,0.04)" stroke="rgba(232,237,246,0.4)" stroke-width="1.3"/>
    <rect x="32" y="50" width="72" height="30" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(232,237,246,0.35)" stroke-width="1.1"/>
    <text x="68" y="69" text-anchor="middle" font-size="11.5" fill="#e8edf6" font-family="-apple-system,Arial">block 1</text>
    <rect x="116" y="50" width="72" height="30" rx="6" fill="rgba(245,185,66,0.10)" stroke="#f5b942" stroke-width="1.4"/>
    <text x="152" y="69" text-anchor="middle" font-size="11.5" fill="#e8edf6" font-family="-apple-system,Arial">block k</text>
    <rect x="200" y="50" width="72" height="30" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(232,237,246,0.35)" stroke-width="1.1"/>
    <text x="236" y="69" text-anchor="middle" font-size="11.5" fill="#e8edf6" font-family="-apple-system,Arial">block L</text>
    <rect x="34" y="98" width="240" height="46" rx="8" fill="rgba(245,185,66,0.07)" stroke="#f5b942" stroke-width="1.3" stroke-dasharray="5 4"/>
    <text x="154" y="117" text-anchor="middle" font-size="11.5" fill="#f5b942" font-family="-apple-system,Arial">mid-stack: the secret word is fully represented</text>
    <text x="154" y="134" text-anchor="middle" font-size="10.5" fill="#93a0b8" font-family="-apple-system,Arial">(logit lens reads it at layers 7–15, rank 1 at 11)</text>
    <rect x="34" y="156" width="240" height="40" rx="8" fill="rgba(255,255,255,0.03)" stroke="rgba(232,237,246,0.25)" stroke-width="1.1"/>
    <text x="154" y="172" text-anchor="middle" font-size="11.5" fill="#93a0b8" font-family="-apple-system,Arial">late stack: the word is suppressed</text>
    <text x="154" y="188" text-anchor="middle" font-size="10.5" fill="#93a0b8" font-family="-apple-system,Arial">output text never mentions it</text>
    <path d="M274 121H342" stroke="#f5b942" stroke-width="1.6" stroke-dasharray="4 4" marker-end="url(#arrg)"/>
    <rect x="346" y="78" width="202" height="88" rx="10" fill="rgba(245,185,66,0.08)" stroke="#f5b942" stroke-width="1.5"/>
    <text x="447" y="100" text-anchor="middle" font-size="11.5" fill="#f5b942" font-family="-apple-system,Arial">OUR MONITOR</text>
    <text x="447" y="118" text-anchor="middle" font-size="11" fill="#e8edf6" font-family="-apple-system,Arial">a tiny decision model</text>
    <text x="447" y="135" text-anchor="middle" font-size="10.5" fill="#93a0b8" font-family="-apple-system,Arial">judgment + score · no generation</text>
    <text x="447" y="152" text-anchor="middle" font-size="12" font-style="italic" fill="#f5b942" font-family="Georgia,serif">hidden word present: 0.97</text>
    <path d="M346 222H158" stroke="#6ee7ff" stroke-width="1.3" stroke-dasharray="4 4" marker-end="url(#arrp)"/>
    <text x="252" y="240" text-anchor="middle" font-size="11" fill="#6ee7ff" font-family="-apple-system,Arial">one recipe · any big model → its custom small monitor</text>
    <text x="252" y="258" text-anchor="middle" font-size="10.5" fill="#93a0b8" font-family="-apple-system,Arial">+ the math of when a line is enough, and when it breaks</text>
  </svg>`;

  /* ── scene definitions ─────────────────────────────────────── */
  // anchor: {search, page, frac} — where the paper scrolls to
  // mark: {search, up, h} — highlight box around the passage;
  //   up/h in PDF points, always resolved via text search
  const SCENES = [
    {
      kicker: "CSI-435/535 · Course talk",
      title: 'Models Know, But Don\'t <span class="em uline">Always Say</span>',
      html: `<div class="scene-sub">Reading a language model's mind with tools from class</div>
             <div class="scene-meta">Group 8 · Jiayu Liao · Zeyu Pan · Yuhan Sun · Kristian Tokos</div>
             <div class="scene-meta sm">Initial presentation · Fall 2026</div>`,
      anchor: { search: null, page: 1, frac: 0 },
      paperless: true,
      notes: "<p>开场一句话：模型知道，但不一定说。</p><p>先按老师的四点要求走：What → Motivation → Related work → Expected deliverable，外加两页初步证据。论文在“差距”页登场。</p>",
    },
    {
      kicker: "Q1 · What we plan to do",
      title: "A small model, <span class='em'>inside</span> a big liar",
      html: `
        <div class="diagram cap plan-diagram">${DIAGRAM_PLAN}</div>
        <ul class="bullets">
          <li>Start from an <b>open-source deceptive model</b> — Taboo: it knows a secret word, uses it, and never says it. Ground truth is known.</li>
          <li>Run a <b>tiny decision model</b> on its internal activations — no text generation, just judgment plus a score.</li>
          <li>The deliverable is <b>general</b>: a recipe to custom-build a small monitor for any big model — and the math of when a line is enough.</li>
        </ul>`,
      anchor: { search: null, page: 1, frac: 0 },
      paperless: true,
      notes: "<p>一页讲完计划：小监测器跑在开源欺诈模型的激活上，判断+打分，不生成文本。</p><p>可泛化部分：给任何大模型定制小监测器的通用配方 + 背后的数理（什么时候一条线够用、什么时候崩）。</p>",
    },
    {
      kicker: "Q2 · Motivation · why now",
      title: 'Reasoning is moving <span class="em">off the page</span>',
      html: `
        <div class="why-row">
          <figure class="tweet-card">
            <img src="assets/astra_pachocki_tweet.png" alt="Jakub Pachocki, OpenAI Chief Scientist, on X">
            <figcaption>OpenAI Chief Scientist Jakub Pachocki · Sep 2, 2026 · on X</figcaption>
          </figure>
          <div class="diagram cap why-diagram">${DIAGRAM_ASTRA}</div>
        </div>
        <ul class="bullets">
          <li>Frontier models keep growing — reports say GPT-6 Astra <b>loops its middle blocks</b>: compute repeats inside hidden states</li>
          <li>So part of the reasoning may never reach the chain of thought — OpenAI's chief scientist calls CoT monitoring <b>“fragile … trending in a negative direction”</b></li>
          <li><b>If intent can hide in the loop, we want a way to detect it</b> — that is this talk</li>
        </ul>`,
      anchor: { search: "1 Introduction", page: 1, frac: 0.62 },
      paperless: true,
      notes: "<p>一页带过：模型越来越大，Astra 有循环层——语义可能藏在循环里，不进思维链；推文是官方承认 CoT 监控“脆弱、在变差”。</p><p>落点一句：有隐藏意图的可能，所以我们要检测。措辞守住 “reports say”——架构来自报道，推文是官方回应。</p>",
    },
    {
      kicker: "Q2 · Motivation · the gap",
      title: "What a model <span class='em'>says</span> ≠ what it <span class='em'>believes</span>",
      html: `
        <div class="neq-row">
          <div class="mini-card">
            <div class="mc-icon">${IC.bubble}</div>
            <div class="mc-label">what it says</div>
            <div class="mc-text">a sampled utterance</div>
          </div>
          <div class="neq">≠</div>
          <div class="mini-card believes">
            <div class="mc-icon">${IC.brain}</div>
            <div class="mc-label">what it believes</div>
            <div class="mc-text">an internal state we can read</div>
          </div>
        </div>
        <ul class="icon-bullets">
          <li>${IC.bubble}<span>Output ≠ internal state</span></li>
          <li>${IC.brain}<span>Falsehoods, fluently</span></li>
          <li>${IC.key}<span>Taboo: knows, never says</span></li>
          <li>${IC.lens}<span class="dim">Read the activations directly</span></li>
        </ul>`,
      anchor: { search: null, page: 1, frac: 0 },
      mark: { search: "Models Know", up: 22, h: 84 },
      notes: "<p>论文在这一页第一次出现，标题被橙框高亮：要检测藏在意图里的东西，就得绕过输出直接读激活——这就是我们的复现论文。</p><p>三个例子：输出≠内部状态；模型会流利说假话；Taboo 被训练成知道但绝不说。</p>",
    },
    {
      kicker: "Q3 · Related work",
      title: "Two published results, <span class='em'>one story</span>",
      html: `
        <div class="paper-grid">
          <div class="paper-card">
            <div class="pc-icon">${IC.clusters}</div>
            <div class="pc-tag">A · main</div>
            <div class="pc-title">The Geometry of Truth</div>
            <div class="pc-venue">Marks &amp; Tegmark · COLM 2024</div>
            <ul class="mini">
              <li>two clusters under PCA</li>
              <li>probes generalize across datasets</li>
              <li>interventions flip answers</li>
            </ul>
          </div>
          <div class="paper-card secondary">
            <div class="pc-icon">${IC.lock}</div>
            <div class="pc-tag">B · secondary</div>
            <div class="pc-title">Eliciting Secret Knowledge</div>
            <div class="pc-venue">Cywiński et al. · 2025</div>
            <ul class="mini">
              <li>Taboo models hide a secret word</li>
              <li>logit lens reads it off the layers</li>
              <li>white-box ≫ black-box</li>
            </ul>
          </div>
        </div>
        <div class="foot" style="margin-top:16px">We reproduce both, then build our monitor on top — everything they used is a tool from this course.</div>`,
      anchor: { search: "Reproduction A (main", page: 1, frac: 0.72 },
      notes: "<p>相关工作：两篇论文一个故事——A 证明真假是线性方向，B 证明隐瞒能逐层定位。我们复现它们，再把监测器建在上面。</p><p>被问“为什么选这两篇”：互补 + 都只用课上工具。</p>",
    },
    {
      kicker: "How · the tools",
      title: "Activations and <span class='em'>probes</span>",
      html: `
        <div class="s3-center">
          <div class="diagram">${DIAGRAM_PROBE}</div>
          <div class="formula">θ = μ<sup>+</sup> − μ<sup>−</sup>
            <span class="fnote">mean-difference direction</span></div>
        </div>
        <ul class="bullets">
          <li>Residual stream: one <b>d-dim vector per token</b>, per block</li>
          <li>Linear probe succeeds ⇒ the property <b>is in the representation</b></li>
        </ul>`,
      anchor: { search: "2 Background", page: 2, frac: 0.05 },
      mark: { search: "Probes.", up: 12, h: 56 },
      notes: "<p>残差流是模型的草稿纸；探针是小分类器。</p><p>线性可预测 ⇒ 性质就在表示里。</p>",
    },
    {
      kicker: "How · the math, written out",
      title: 'Not just <span class="em">abbreviations</span>',
      html: `
        <div class="f-grid">
          <div class="f-card">
            <div class="f-head"><span class="f-abbr">PCA</span><span class="f-full">principal component analysis</span></div>
            <div class="f-formula">C = X̃<sup>⊤</sup>X̃ / (n−1),&nbsp;&nbsp;C v<sub>k</sub> = λ<sub>k</sub> v<sub>k</sub></div>
            <div class="f-plain">rotate the point cloud so the biggest spread comes first — then plot the top two axes. <b>No labels used.</b></div>
          </div>
          <div class="f-card">
            <div class="f-head"><span class="f-abbr">LR</span><span class="f-full">logistic regression</span></div>
            <div class="f-formula">p = σ(w<sup>⊤</sup>x) = 1 / (1 + e<sup>−w<sup>⊤</sup>x</sup>)</div>
            <div class="f-plain">the classifier from class: a weighted sum squashed into a probability, trained by gradient descent. <b>Judgment, no generation.</b></div>
          </div>
          <div class="f-card">
            <div class="f-head"><span class="f-abbr">MM / LDA</span><span class="f-full">mass-mean · Fisher's linear discriminant</span></div>
            <div class="f-formula">θ = μ<sup>+</sup> − μ<sup>−</sup>;&nbsp;&nbsp;Fisher: w ∝ S<sub>w</sub><sup>−1</sup>(μ<sup>+</sup> − μ<sup>−</sup>)</div>
            <div class="f-plain">point from the false cloud's center to the true cloud's center; Fisher whitens by the within-class covariance S<sub>w</sub>. <b>Closed form, no training.</b></div>
          </div>
          <div class="f-card">
            <div class="f-head"><span class="f-abbr">CCS</span><span class="f-full">contrast-consistent search</span></div>
            <div class="f-formula">min<sub>θ</sub> Σ [ (p<sub>θ</sub>(x<sup>+</sup>) + p<sub>θ</sub>(x<sup>−</sup>) − 1)<sup>2</sup> + min(p<sub>θ</sub>, 1−p<sub>θ</sub>)<sup>2</sup> ]</div>
            <div class="f-plain">needs <b>no labels</b>: a statement and its negation must get opposite, confident answers.</div>
          </div>
          <div class="f-card wide">
            <div class="f-head"><span class="f-abbr">Logit lens</span><span class="f-full">decode any layer into vocabulary</span></div>
            <div class="f-formula">logits<sub>ℓ</sub> = W<sub>U</sub> · LayerNorm( h<sub>ℓ</sub> )&nbsp;&nbsp;→&nbsp;&nbsp;rank of the secret word at layer ℓ</div>
            <div class="f-plain">borrow the model's <b>own output head</b> and ask each middle layer: what would you say right now? This is how we locate <b>at which layer the model lies</b>.</div>
          </div>
        </div>
        <div class="foot">All probes are bias-free on mean-centered activations — exactly the setup of the reproduced papers.</div>`,
      anchor: { search: "Logit lens", page: 2, frac: 0.6 },
      mark: { search: "Logit lens.", up: 12, h: 58 },
      notes: "<p>每张卡片：全称 + 公式 + 一句大白话。不用全讲，哪张被问展开哪张。</p><p>强调 LR/MM/CCS 都无偏置、先中心化；CCS 不需要标签；logit lens 是“哪一层撒谎”的尺子。</p>",
    },
    {
      kicker: "How · the data",
      title: "Data: simple <span class='em'>true/false</span> statements",
      html: `
        <div class="stmt"><span class="badge t">TRUE</span>“The city of Krasnodar is in Russia.”</div>
        <div class="stmt false"><span class="badge f">FALSE</span>“The city of Krasnodar is in South Africa.”</div>
        <div class="chips">
          <span class="chip">cities · <span class="n">1,496</span></span>
          <span class="chip">neg_cities · <span class="n">1,496</span></span>
          <span class="chip">sp_en_trans · <span class="n">354</span></span>
        </div>
        <ul class="bullets">
          <li>Raw statements · <b>last token</b> (the period) · mid-layer</li>
          <li><span class="dim">No QA formatting, no few-shot</span></li>
        </ul>`,
      anchor: { search: "3.1 Setup", page: 2, frac: 0.5 },
      mark: { search: "3.1 Setup", up: 16, h: 150 },
      notes: "<p>读两条例子；强调协议是原文设定，测的是模型自己的表示。</p>",
    },
    {
      kicker: "First evidence",
      title: "True and false <span class='em'>separate</span> — before any training",
      html: `<div class="evidence-hint">${IC.mark} already done: our own run of the two-clusters figure — the plan is feasible</div>`,
      hero: true,
      anchor: { search: "Two clusters", page: 3, frac: 0.08 },
      mark: { search: "Two clusters", up: 13, h: 62 },
      notes: "<p>每个点是一条陈述的激活；PCA 不知道标签却分成两团。</p><p>这就是“模型知道”的直接证据。</p>",
    },
    {
      kicker: "What we need · from class",
      title: "Exactly the <span class='em'>course toolbox</span>",
      html: `
        <div class="tool-grid">
          <div class="tool">
            <div class="tool-icon">${IC.clusters}</div>
            <div class="tool-name">PCA</div>
            <div class="tool-map">eigendecomposition of the covariance → <b>the two-cluster figure</b></div>
          </div>
          <div class="tool">
            <div class="tool-icon">${IC.split}</div>
            <div class="tool-name">Logistic regression</div>
            <div class="tool-map">exactly as in class → <b>the LR probe</b></div>
          </div>
          <div class="tool">
            <div class="tool-icon">${IC.lda}</div>
            <div class="tool-name">Fisher LDA</div>
            <div class="tool-map">same idea → <b>mean-difference probe θ = μ⁺ − μ⁻</b></div>
          </div>
          <div class="tool">
            <div class="tool-icon">${IC.lens}</div>
            <div class="tool-name">Train / test split</div>
            <div class="tool-map">across topics → <b>cross-dataset generalization</b></div>
          </div>
        </div>`,
      anchor: { search: "Probes", page: 2, frac: 0.38 },
      notes: "<p>点明和课上的 PCA、逻辑回归、Fisher 判别一一对应。</p>",
    },
    {
      kicker: "Q4 · Expected deliverables",
      title: "What we will <span class='em'>hand in</span>",
      html: `
        <div class="tool-grid three">
          <div class="tool">
            <div class="tool-icon">${IC.shield}</div>
            <div class="d-tag">D1</div>
            <div class="tool-name">A working monitor</div>
            <div class="tool-map">a small probe running <b>live on the Taboo model's activations</b> — flags hidden knowledge with a score, mid-forward-pass</div>
          </div>
          <div class="tool">
            <div class="tool-icon">${IC.lens}</div>
            <div class="d-tag">D2</div>
            <div class="tool-name">The general recipe</div>
            <div class="tool-map">big model in → custom small monitor out: <b>which layer to tap, which probe to pick</b>, and the math of when a line is enough</div>
          </div>
          <div class="tool">
            <div class="tool-icon">${IC.clusters}</div>
            <div class="d-tag">D3</div>
            <div class="tool-name">An honest evaluation</div>
            <div class="tool-map">accuracy alone is not enough — <b>causal checks (NIE)</b>, failure cases like negation, all in the final report</div>
          </div>
        </div>
        <div class="timeline">
          <div class="tl-node now">
            <div class="tl-dot"></div>
            <div class="tl-when">Done · feasibility</div>
            <div class="tl-what">the science reproduced<br><span class="dim">all five figures · numbers match<br>LR fails at 0.33 · MM transfers 0.97</span></div>
          </div>
          <div class="tl-node">
            <div class="tl-dot"></div>
            <div class="tl-when">Midterm · Oct 26</div>
            <div class="tl-what">the monitor suite<br><span class="dim">probes benchmarked on Taboo ·<br>why negation breaks LR · CCS vs MM</span></div>
          </div>
          <div class="tl-node final">
            <div class="tl-dot"></div>
            <div class="tl-when">Final · Dec 7</div>
            <div class="tl-what">the recipe + prototype<br><span class="dim">a second model or dataset ·<br>big model in, monitor out · report</span></div>
          </div>
        </div>`,
      anchor: { search: "4 Reproduction B", page: 4, frac: 0.4 },
      notes: "<p>交付三件套：能跑的监测器（D1）、通用配方+数理（D2）、诚实的评估（D3，含因果检验和失败案例）。</p><p>时间轴：可行性已做完（复现全部吻合）；期中做 Taboo 上的探针基准；期末做泛化配方和原型。</p>",
    },
    {
      kicker: "Closing",
      title: "Thank you",
      html: `
        <div class="motto">取得绩点是我们的目标，为人类服务是我们的标准。</div>
        <div class="motto-en">The GPA is our goal — serving humanity is our standard.</div>
        <div class="scene-meta" style="margin-top:34px">Group 8 · questions welcome</div>`,
      anchor: { search: "5 Discussion", page: 4, frac: 0.8 },
      notes: "<p>收尾一句中文格言+英文解释，说完停一拍，进提问。</p>",
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
  const elHero = $("hero-panel");

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
    window.__ready = true; // screenshot hook
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
    const top = info.top + y - 56; // anchor sits slightly below the window top
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
    elHero.classList.toggle("hidden", !SCENES[idx].hero);
    elLayer.classList.toggle("has-hero", !!SCENES[idx].hero);
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
        elHero.classList.add("animated");
      }));
  })();
})();
