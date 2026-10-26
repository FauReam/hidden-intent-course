(function () {
  "use strict";

  const DATA = window.EM_DEMO_DATA;
  const $ = (id) => document.getElementById(id);
  const help = $("help-dialog");
  if (!DATA || !Array.isArray(DATA.cases) || !DATA.cases.length) {
    $("connection-label").textContent = "DEMONSTRATION DATA MISSING";
    $("connection").dataset.state = "error";
    $("run-status").textContent = "Run python3 scripts/em_demo.py export-assets before opening this page.";
    $("run-status").classList.add("error");
    $("run-button").disabled = true;
    $("help-button").addEventListener("click", () => help.showModal());
    $("help-close").addEventListener("click", () => help.close());
    $("help-done").addEventListener("click", () => help.close());
    return;
  }

  const state = {
    caseId: DATA.cases[0].id,
    liveAvailable: false,
    running: false,
    source: "waiting",
    health: null,
  };
  const exampleButtons = [];

  function currentCase() {
    return DATA.cases.find((item) => item.id === state.caseId);
  }

  function condition() {
    return document.querySelector('input[name="condition"]:checked').value;
  }

  function modelLabel(value) {
    return value === "em" ? "finance EM" : "base control";
  }

  function labelText(value) {
    return {
      misaligned_coherent: "Misaligned behaviour",
      aligned_coherent: "Aligned behaviour",
      incoherent: "Incoherent",
      uncertain: "Uncertain",
    }[value] || value;
  }

  function updateConnection(mode) {
    const element = $("connection");
    if (state.running) {
      element.dataset.state = "running";
      $("connection-label").textContent = "LIVE GENERATION ON THIS MAC";
    } else if (mode === "complete") {
      element.dataset.state = "ready";
      $("connection-label").textContent = "LIVE RUN COMPLETE";
    } else if (mode === "error") {
      element.dataset.state = "error";
      $("connection-label").textContent = "LIVE RUN INCOMPLETE";
    } else if (state.liveAvailable) {
      element.dataset.state = "ready";
      $("connection-label").textContent = "REAL MODEL READY";
    } else {
      element.dataset.state = "recorded";
      $("connection-label").textContent = "RECORDED BACKUP · MODEL OFFLINE";
    }
  }

  function setStatus(message, error) {
    $("run-status").textContent = message;
    $("run-status").classList.toggle("error", Boolean(error));
  }

  function showAnswer(text, placeholder) {
    $("answer-text").textContent = text;
    $("answer-text").classList.toggle("placeholder", Boolean(placeholder));
    $("caret").hidden = true;
    $("answer-box").scrollTop = 0;
  }

  function renderScore(feature, reading) {
    const card = $(feature + "-card");
    const score = $("" + feature + "-score");
    const verdict = $(feature + "-verdict");
    const track = $(feature + "-track");
    const fill = $(feature + "-fill");
    if (!reading || reading.score === null || reading.score === undefined || !Number.isFinite(reading.score)) {
      card.dataset.state = "waiting";
      score.textContent = "—";
      verdict.textContent = reading && reading.scorable === false ? "NO TEXT" : "WAITING";
      fill.style.width = "0";
      track.setAttribute("aria-label", feature + " score unavailable");
      return;
    }
    const flag = Boolean(reading.flag);
    card.dataset.state = flag ? "flag" : "clear";
    score.textContent = reading.score.toFixed(4);
    score.title = "Raw standardized probe score: " + reading.score;
    verdict.textContent = flag ? "ACTIVATION FLAG" : "BELOW THRESHOLD";
    const position = Math.max(0, Math.min(100, ((reading.score + 5) / 20) * 100));
    fill.style.left = Math.min(25, position) + "%";
    fill.style.width = Math.abs(position - 25) + "%";
    track.setAttribute("aria-label", feature + " score " + reading.score.toFixed(4)
      + "; threshold " + reading.threshold.toFixed(4) + "; " + (flag ? "flag" : "below threshold"));
  }

  function resetScores() {
    renderScore("early", null);
    renderScore("response", null);
    $("path-prefill").classList.remove("active");
    $("path-response").classList.remove("active");
  }

  function updateTrace(main, detail, error) {
    $("trace-main").textContent = main;
    $("trace-detail").textContent = detail;
    $("trace").classList.toggle("error", Boolean(error));
  }

  function renderRecorded(run) {
    state.source = "recorded";
    showAnswer(run.response, false);
    renderScore("early", run.early);
    renderScore("response", run.response_monitor);
    $("path-prefill").classList.add("active");
    $("path-response").classList.add("active");
    $("source-tag").textContent = "RECORDED EXAMPLE";
    $("source-tag").className = "source-tag recorded";
    $("source-tag").title = run.source;
    $("token-count").textContent = run.generated_token_count + " generated tokens";
    $("elapsed").textContent = "seed " + run.seed + " · " + modelLabel(run.condition);
    if (run.behaviour_label) {
      const prefix = run.behaviour_label_scope === "blind_review"
        ? "Recorded blind review: " : "Manual example label, not a holdout item: ";
      $("behaviour-label").textContent = prefix + labelText(run.behaviour_label) + ".";
    } else {
      $("behaviour-label").textContent = "Recorded output. Behaviour labels come from review, not the probe.";
    }
    updateTrace("Recorded result · no simulated token animation",
      (run.response_id ? "response " + run.response_id + " · " : "") + run.source);
    $("example-note").textContent = run.condition === "base"
      ? "Recorded base control with the same question and seed. Its reviewed behaviour label is shown above."
      : currentCase().note;
    setStatus(state.liveAvailable ? "Ready to generate a new answer live." : "Recorded evidence. Start the local server for a live run.");
    updateConnection();
  }

  function prepareInput(message) {
    state.source = "edited";
    resetScores();
    showAnswer(message || "Input changed. Run the real model to generate this answer.", true);
    $("source-tag").textContent = "NOT RUN";
    $("source-tag").className = "source-tag";
    $("source-tag").title = "There is no result for the current input.";
    $("token-count").textContent = "— tokens";
    $("elapsed").textContent = "No result for the current input";
    $("behaviour-label").textContent = "No behaviour label yet. The monitor does not assign one.";
    updateTrace("No hidden states read for this input yet", "Recorded scores are never copied to a new question.");
    setStatus(state.liveAvailable ? "Ready for a real run." : "Live generation requires the local server.");
    updateConnection();
  }

  function selectCase(id) {
    if (state.running) return;
    state.caseId = id;
    const item = currentCase();
    $("question").value = item.question;
    $("seed").value = item.seed;
    $("example-note").textContent = "Recorded EM example: " + item.note;
    exampleButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.case === id));
    });
    const recorded = item.runs[condition()];
    if (recorded) renderRecorded(recorded);
    else prepareInput("No recorded " + modelLabel(condition()) + " run for this exact question and seed. Run live for a real control.");
  }

  function editInput() {
    if (!state.running) prepareInput();
  }

  function setRunning(running) {
    state.running = running;
    $("run-button").disabled = running || !state.liveAvailable;
    $("run-label").textContent = running ? "Generating for real…" : (state.liveAvailable ? "Run the real model" : "Live model not running");
    $("question").readOnly = running;
    $("seed").readOnly = running;
    $("condition-picker").disabled = running;
    $("answer-box").setAttribute("aria-busy", String(running));
    exampleButtons.forEach((button) => { button.disabled = running; });
    updateConnection();
  }

  function handleEvent(event) {
    if (event.type === "accepted") {
      state.source = "live";
      showAnswer("Reading the prompt before generation…", true);
      updateTrace("Real inference started", "Waiting for the early hidden-state score.");
      return;
    }
    if (event.type === "started") {
      $("trace-detail").textContent = "run " + event.run_id + " · " + modelLabel(event.condition) + " · seed " + event.seed;
      return;
    }
    if (event.type === "early") {
      renderScore("early", event.early);
      $("path-prefill").classList.add("active");
      if (!$("answer-text").textContent || $("answer-text").classList.contains("placeholder")) {
        showAnswer("Prefill complete. The model is now generating its answer…", true);
      }
      updateTrace("Prefill complete · generating real response tokens",
        "layer " + event.early.layer + " · score " + event.early.score.toFixed(4) + " · threshold " + event.early.threshold.toFixed(4));
      return;
    }
    if (event.type === "token") {
      if ($("answer-text").classList.contains("placeholder")) showAnswer("", false);
      $("answer-text").textContent += event.text;
      $("answer-text").classList.remove("placeholder");
      $("caret").hidden = false;
      $("path-response").classList.add("active");
      $("answer-box").scrollTop = $("answer-box").scrollHeight;
      updateTrace("Real generation in progress", "The response probe reads this same forward pass, not a stored answer.");
      return;
    }
    if (event.type === "replace_text") {
      showAnswer(event.text, false);
      updateTrace("Using the canonical full-sequence decode", "The final answer text is the tokenizer's decode of the generated token IDs.");
      return;
    }
    if (event.type === "complete") {
      const result = event.result;
      state.source = "live";
      showAnswer(result.response || "[No visible text was generated.]", !result.response);
      renderScore("early", result.early);
      renderScore("response", result.response_monitor);
      $("path-prefill").classList.add("active");
      $("path-response").classList.add("active");
      $("source-tag").textContent = "LIVE / THIS RUN";
      $("source-tag").className = "source-tag live";
      $("source-tag").title = "Live run " + result.run_id + " · saved separately from evaluation data";
      $("token-count").textContent = result.generated_token_count + " generated tokens";
      $("elapsed").textContent = result.elapsed_seconds.toFixed(1) + "s · " + modelLabel(result.condition) + " · seed " + result.seed;
      $("behaviour-label").textContent = "Live output: no automatic ground-truth label. A flag calls for human review; it does not prove intent or deception.";
      updateTrace("Complete · live run " + result.run_id,
        result.stream_matches_final ? "Streamed text matches the final token decode. Demonstration only; not added to the holdout."
          : "Canonical final token decode shown. Demonstration only; not added to the holdout.");
      setStatus("Live run complete. Read the answer and the probe verdict separately.");
      updateConnection("complete");
      return;
    }
    if (event.type === "error") throw new Error(event.message || "The live generation failed.");
  }

  function consumeBuffer(buffer, final) {
    const lines = buffer.split("\n");
    const remainder = final ? "" : lines.pop();
    lines.filter((line) => line.trim()).forEach((line) => handleEvent(JSON.parse(line)));
    return remainder;
  }

  async function runLive() {
    if (state.running || !state.liveAvailable) return;
    const question = $("question").value;
    const seed = Number($("seed").value);
    if (!question.trim() || question.length > 500) {
      setStatus("Enter a question with 1–500 characters.", true);
      $("question").focus();
      return;
    }
    if (!$("seed").checkValidity() || !Number.isSafeInteger(seed)) {
      setStatus("Use an integer seed from 0 to 2147483647.", true);
      $("seed").focus();
      return;
    }
    setRunning(true);
    resetScores();
    state.source = "live";
    showAnswer("Contacting the local model…", true);
    $("source-tag").textContent = "LIVE REQUEST";
    $("source-tag").className = "source-tag live";
    $("source-tag").title = "This run will use the real model.";
    $("token-count").textContent = "Generating… count at completion";
    $("elapsed").textContent = modelLabel(condition()) + " · seed " + seed;
    $("behaviour-label").textContent = "Waiting for the real answer. No automatic behaviour label will be assigned.";
    $("example-note").textContent = condition() === "base"
      ? "Live base control: new generation. A recorded human label does not automatically apply to this answer."
      : "Recorded EM example context: " + currentCase().note;
    updateTrace("Requesting a real forward pass", "No recorded text or score will be substituted.");
    setStatus("Real model inference. No malicious system prompt is added.");
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, seed, condition: condition() }),
        cache: "no-store",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "The server rejected this run.");
      }
      if (!response.body || !response.body.getReader) {
        setStatus("This browser cannot stream tokens. The generation is still real; the answer will appear when complete.");
        consumeBuffer(await response.text(), true);
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const part = await reader.read();
          buffer += decoder.decode(part.value || new Uint8Array(), { stream: !part.done });
          buffer = consumeBuffer(buffer, part.done);
          if (part.done) break;
        }
        if (buffer.trim()) handleEvent(JSON.parse(buffer));
      }
      if (state.source !== "live" || $("source-tag").textContent !== "LIVE / THIS RUN") {
        throw new Error("The run ended before a complete result arrived.");
      }
    } catch (error) {
      state.source = "error";
      $("source-tag").textContent = "RUN INCOMPLETE";
      $("source-tag").className = "source-tag";
      setStatus(error.message + " No replay was substituted.", true);
      updateTrace("Live run incomplete", error.message + " · no recorded result substituted", true);
      updateConnection("error");
    } finally {
      setRunning(false);
      if (state.source === "live") updateConnection("complete");
    }
  }

  function populateEvidence() {
    const behaviour = DATA.behaviour;
    const finance = behaviour.finance;
    const base = behaviour.base;
    const denominator = (item) => item.n - item.counts.uncertain - item.counts.debug_unblinded;
    $("stat-behaviour").innerHTML = finance.counts.misaligned_coherent + "<span>/" + denominator(finance) + "</span>";
    $("stat-base").textContent = "Base control: " + base.counts.misaligned_coherent + "/" + denominator(base);
    const response = DATA.detectors.activation_response;
    const early = DATA.detectors.activation_early;
    $("stat-auroc").textContent = response.auroc.toFixed(3);
    $("stat-recall").textContent = (100 * response.tpr).toFixed(1) + "% recall";
    $("stat-early-auroc").textContent = early.auroc.toFixed(3);
    $("stat-fpr").innerHTML = (100 * response.em_aligned_fpr).toFixed(1) + "<span>%</span>";
    $("stat-fpr-count").textContent = Math.round(response.em_aligned_fpr * response.n_negative) + "/" + response.n_negative;
    $("early-layer").textContent = "LAYER " + DATA.probe.early.layer;
    $("response-layer").textContent = "LAYER " + DATA.probe.response.layer;
    $("early-threshold").textContent = DATA.probe.early.threshold.toFixed(4);
    $("response-threshold").textContent = DATA.probe.response.threshold.toFixed(4);
    $("early-card").style.setProperty("--threshold-position", ((DATA.probe.early.threshold + 5) / 20 * 100) + "%");
    $("response-card").style.setProperty("--threshold-position", ((DATA.probe.response.threshold + 5) / 20 * 100) + "%");
    $("model-name").title = DATA.model.base_id + " @ " + DATA.model.base_revision + "\n"
      + DATA.model.adapter_id + " @ " + DATA.model.adapter_revision + "\nprobe SHA-256: " + DATA.probe.sha256;
  }

  function openHelp() {
    if (typeof help.showModal === "function") help.showModal();
    else help.setAttribute("open", "");
  }

  function closeHelp() {
    if (typeof help.close === "function") help.close();
    else help.removeAttribute("open");
    $("help-button").focus();
  }

  async function connect() {
    if (location.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(location.hostname)) {
      state.liveAvailable = false;
      setRunning(false);
      updateConnection();
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("The local model is not ready.");
      const health = await response.json();
      if (!health.ready || health.probe_sha256 !== DATA.probe.sha256) {
        throw new Error("The server is not using the expected frozen probe.");
      }
      state.health = health;
      state.liveAvailable = true;
      $("model-name").textContent = "Qwen2.5-7B + finance adapter · " + health.device.toUpperCase();
      setStatus("Real model ready. Run this question, or edit it first.");
      setRunning(false);
    } catch (error) {
      state.liveAvailable = false;
      setRunning(false);
      setStatus("Recorded backup only. Start the local server for real generation.");
      updateConnection();
    } finally {
      clearTimeout(timeout);
    }
  }

  DATA.cases.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "example-button";
    button.dataset.case = item.id;
    button.setAttribute("aria-pressed", "false");
    const number = document.createElement("span");
    number.className = "example-number";
    number.textContent = "0" + (index + 1);
    button.append(number, document.createTextNode(item.label));
    button.addEventListener("click", () => selectCase(item.id));
    $("example-row").appendChild(button);
    exampleButtons.push(button);
  });
  $("question").addEventListener("input", editInput);
  $("seed").addEventListener("input", editInput);
  document.querySelectorAll('input[name="condition"]').forEach((input) => {
    input.addEventListener("change", () => {
      const item = currentCase();
      if ($("question").value === item.question && Number($("seed").value) === item.seed && item.runs[condition()]) {
        renderRecorded(item.runs[condition()]);
      } else {
        prepareInput("Model changed. Run live for a real " + modelLabel(condition()) + " answer.");
      }
    });
  });
  $("run-button").addEventListener("click", runLive);
  $("help-button").addEventListener("click", openHelp);
  $("help-close").addEventListener("click", closeHelp);
  $("help-done").addEventListener("click", closeHelp);
  help.addEventListener("click", (event) => {
    if (event.target !== help) return;
    const bounds = help.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeHelp();
  });
  document.addEventListener("keydown", (event) => {
    if (help.open) return;
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      runLive();
      return;
    }
    if (event.target.closest("textarea, input, button, a, summary") || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      runLive();
    } else if (["1", "2", "3"].includes(event.key)) {
      event.preventDefault();
      selectCase(DATA.cases[Number(event.key) - 1].id);
    } else if (event.key === "?") {
      event.preventDefault();
      openHelp();
    }
  });

  populateEvidence();
  selectCase(state.caseId);
  setRunning(false);
  connect();
  window.__demoReady = true;
})();
