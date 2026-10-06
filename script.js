/* Six Iconic Lives: shared JavaScript.
   data.js defines window.SITE (figures, quiz questions, clues). This file adds the menu animation, the scroll bar,
   the glossary filter, the quiz, the four games and the one-question check on each figure page. */
(function () {
  "use strict";

  var D = window.SITE || { figures: [], questions: [], memFacts: {}, clues: {} };
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function $(sel, root) { return (root || document).querySelector(sel); }
  function byId(id) { return document.getElementById(id); }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function fig(id) { return D.figures.filter(function (f) { return f.id === id; })[0]; }
  var ids = D.figures.map(function (f) { return f.id; });

  // ---------- Menu: pop the tapped link, fade the page out, then go ----------
  var nav = $(".nav");
  if (nav) {
    nav.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var url;
      try { url = new URL(a.href, window.location.href); } catch (err) { return; }
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.hash)) return;
      e.preventDefault();
      a.classList.add("clicked");
      document.body.classList.add("leaving");
      setTimeout(function () { window.location.href = a.href; }, reduce ? 0 : 280);
    });
  }
  window.addEventListener("pageshow", function () {
    document.body.classList.remove("leaving");
    var c = document.querySelector(".nav a.clicked");
    if (c) c.classList.remove("clicked");
  });

  // ---------- Scroll progress bar ----------
  var bar = $(".progress i"), ticking = false;
  function updateProgress() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? window.scrollY / h : 0;
    if (bar) bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, p)) + ")";
    ticking = false;
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); } }, { passive: true });
  updateProgress();

  // ---------- Glossary filter ----------
  var filter = byId("gloss-filter");
  if (filter) {
    var cards = Array.prototype.slice.call(document.querySelectorAll("#gloss .term"));
    var empty = byId("gloss-empty");
    filter.addEventListener("input", function () {
      var q = filter.value.trim().toLowerCase(), shown = 0;
      cards.forEach(function (c) {
        var match = !q || c.getAttribute("data-search").indexOf(q) !== -1;
        c.hidden = !match;
        if (match) shown++;
      });
      empty.hidden = shown !== 0;
    });
  }

  // ---------- Quiz questions (quiz page and the check on each figure page) ----------
  function questionHtml(item, i, showNumber) {
    var h = '<p class="prompt">' + (showNumber ? '<span class="n">Q' + (i + 1) + "</span>" : "") + item.q + '</p><div class="opts">';
    item.o.forEach(function (t, j) { h += '<button type="button" class="opt" data-q="' + i + '" data-o="' + j + '">' + t + "</button>"; });
    return h + '</div><p class="explain" hidden></p>';
  }
  function answer(btn, item) {
    var box = btn.closest(".q");
    var oi = +btn.getAttribute("data-o");
    Array.prototype.forEach.call(box.querySelectorAll(".opt"), function (b, idx) {
      b.disabled = true;
      if (idx === item.a) b.classList.add("right");
      else if (idx === oi) b.classList.add("wrong");
    });
    var ex = box.querySelector(".explain");
    ex.hidden = false;
    ex.textContent = (oi === item.a ? "Correct. " : "Not quite. ") + item.e;
    return oi === item.a;
  }

  var quiz = byId("quiz");
  if (quiz) {
    var scoreEl = byId("score"), score = 0, answered = 0, total = D.questions.length;
    var buildQuiz = function () {
      score = 0; answered = 0;
      quiz.innerHTML = "";
      D.questions.forEach(function (item, i) {
        var box = document.createElement("div");
        box.className = "q t-" + item.f;
        box.innerHTML = questionHtml(item, i, true);
        quiz.appendChild(box);
      });
      updateScore();
    };
    var updateScore = function () {
      scoreEl.textContent = score + " of " + total + " answered correctly" + (answered === total ? ". All questions done." : "");
    };
    quiz.addEventListener("click", function (e) {
      var btn = e.target.closest(".opt");
      if (!btn || btn.disabled) return;
      var item = D.questions[+btn.getAttribute("data-q")];
      answered++;
      if (answer(btn, item)) score++;
      updateScore();
    });
    byId("reset").addEventListener("click", buildQuiz);
    buildQuiz();
  }

  var check = byId("check");
  if (check) {
    var fid = check.getAttribute("data-fig");
    var item = D.questions.filter(function (q) { return q.f === fid; })[0];
    if (item) {
      check.innerHTML = questionHtml(item, 0, false);
      check.addEventListener("click", function (e) {
        var btn = e.target.closest(".opt");
        if (btn && !btn.disabled) answer(btn, item);
      });
    }
  }

  // ---------- Games ----------
  var gTabs = byId("game-tabs");
  if (gTabs) {
    var panels = { memory: byId("g-memory"), order: byId("g-order"), who: byId("g-who"), duel: byId("g-duel") };
    var CONF = ["#c8102e", "#e8851a", "#e8b92c", "#2f9e6e", "#2e7fd1", "#6a4fc2"];
    var memStore = {};

    function bestGet(k) { try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : (memStore[k] || null); } catch (e) { return memStore[k] || null; } }
    function bestSet(k, v) { memStore[k] = v; try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
    function fmt(s) { return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
    function confetti(host, count) {
      if (reduce) return;
      var box = document.createElement("div");
      box.className = "confetti-box";
      box.setAttribute("aria-hidden", "true");
      for (var i = 0; i < (count || 54); i++) {
        var s = document.createElement("i");
        s.style.left = Math.random() * 100 + "%";
        s.style.background = CONF[i % CONF.length];
        s.style.setProperty("--dx", Math.random() * 180 - 90 + "px");
        s.style.setProperty("--rot", Math.random() * 720 - 360 + "deg");
        s.style.animationDelay = Math.random() * 0.4 + "s";
        s.style.animationDuration = 1.7 + Math.random() * 1.3 + "s";
        box.appendChild(s);
      }
      host.appendChild(box);
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 3600);
    }
    function countUp(node, to, from, suffix, prefix) {
      suffix = suffix || ""; prefix = prefix || "";
      if (reduce) { node.textContent = prefix + to + suffix; return; }
      var t0 = null, dur = 900;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        node.textContent = prefix + Math.round(from + (to - from) * e) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    gTabs.addEventListener("click", function (e) {
      var t = e.target.closest(".gtab");
      if (!t) return;
      Array.prototype.forEach.call(gTabs.children, function (b) { b.setAttribute("aria-selected", b === t ? "true" : "false"); });
      Object.keys(panels).forEach(function (k) {
        var show = k === t.getAttribute("data-g");
        panels[k].hidden = !show;
        if (show) { panels[k].classList.remove("enter"); void panels[k].offsetWidth; panels[k].classList.add("enter"); }
      });
    });

    // Game 1: memory match with flip cards, timer, stars and best score
    (function () {
      var el = panels.memory, level = "full", cards, first, lock, moves, pairs, total, t0, timer, secs, finished;
      function pairCount() { return level === "easy" ? 4 : D.figures.length; }
      function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
      function tick() { secs = Math.floor((Date.now() - t0) / 1000); var t = byId("mem-time"); if (t) t.textContent = fmt(secs); }
      function bestText() { var b = bestGet("sil-mem-" + level); return "Best " + (b ? b.moves + " moves, " + fmt(b.time) : "none yet"); }
      function hud() {
        byId("mem-moves").textContent = "Moves " + moves;
        byId("mem-pairs").textContent = "Pairs " + pairs + "/" + total;
        byId("mem-best").textContent = bestText();
      }
      function setMsg(t) { byId("mem-msg").textContent = t; }
      function paint(i) {
        var b = el.querySelector('[data-i="' + i + '"]');
        if (!b) return;
        b.classList.toggle("open", !!(cards[i].open || cards[i].done));
        b.classList.toggle("done", !!cards[i].done);
        b.setAttribute("aria-pressed", cards[i].open || cards[i].done ? "true" : "false");
      }
      function start() {
        stopTimer();
        total = pairCount();
        cards = [];
        shuffle(D.figures).slice(0, total).forEach(function (f) {
          cards.push({ id: f.id, kind: "name", text: f.name });
          cards.push({ id: f.id, kind: "fact", text: D.memFacts[f.id] });
        });
        cards = shuffle(cards); first = null; lock = false; moves = 0; pairs = 0; secs = 0; t0 = null; finished = false;
        el.innerHTML =
          '<div class="game-bar"><p id="mem-msg" aria-live="polite">Match each person to what they are known for. The timer starts on your first flip.</p>' +
          '<div class="seg" role="group" aria-label="Difficulty"><button type="button" class="segbtn' + (level === "easy" ? " on" : "") + '" data-level="easy">Easy, 4 pairs</button><button type="button" class="segbtn' + (level === "full" ? " on" : "") + '" data-level="full">Full, 6 pairs</button></div></div>' +
          '<div class="hud"><span class="pill" id="mem-time">0:00</span><span class="pill" id="mem-moves"></span><span class="pill" id="mem-pairs"></span><span class="pill soft" id="mem-best"></span></div>' +
          '<div class="memory">' + cards.map(function (c, i) {
            return '<button type="button" class="mcard t-' + c.id + '" data-i="' + i + '" style="--d:' + (i * 55) + 'ms" aria-pressed="false"><span class="inner"><span class="back"><span class="sr">Face-down card</span></span><span class="face ' + c.kind + '">' + c.text + "</span></span></button>";
          }).join("") + "</div>" +
          '<div id="mem-end"></div><div class="game-actions"><button type="button" class="gbtn" id="mem-restart">New game</button></div>';
        hud();
      }
      function win() {
        finished = true; stopTimer(); tick();
        var stars = moves <= total + 2 ? 3 : moves <= total * 2 ? 2 : 1;
        var b = bestGet("sil-mem-" + level), record = !b || moves < b.moves || (moves === b.moves && secs < b.time);
        if (record) bestSet("sil-mem-" + level, { moves: moves, time: secs });
        hud();
        var s = "";
        for (var i = 0; i < 3; i++) s += '<span class="star' + (i < stars ? " on" : "") + '" style="animation-delay:' + (0.2 + i * 0.25) + 's">★</span>';
        byId("mem-end").innerHTML = '<div class="win"><p class="stars" aria-label="' + stars + ' out of 3 stars">' + s + "</p><h3>All matched</h3><p>" + moves + " moves in " + fmt(secs) + (record ? ". New best." : ".") + "</p></div>";
        setMsg("You found every pair.");
        confetti(el);
      }
      function flip(i) {
        var c = cards[i];
        if (lock || finished || c.open || c.done) return;
        if (t0 === null) { t0 = Date.now(); timer = setInterval(tick, 250); }
        c.open = true; paint(i);
        if (first === null) { first = i; return; }
        moves++;
        var a = first, other = cards[a];
        first = null; lock = true;
        if (other.id === c.id) {
          setTimeout(function () {
            other.open = false; c.open = false; other.done = true; c.done = true;
            paint(a); paint(i); pairs++; lock = false; hud();
            setMsg("A match. " + fig(c.id).name + ".");
            if (pairs === total) win();
          }, 450);
        } else {
          hud(); setMsg("Not a match.");
          var ba = el.querySelector('[data-i="' + a + '"]'), bi = el.querySelector('[data-i="' + i + '"]');
          setTimeout(function () { ba.classList.add("bad"); bi.classList.add("bad"); }, 380);
          setTimeout(function () {
            ba.classList.remove("bad"); bi.classList.remove("bad");
            other.open = false; c.open = false; paint(a); paint(i); lock = false;
          }, 1050);
        }
        hud();
      }
      el.addEventListener("click", function (e) {
        var lv = e.target.closest(".segbtn");
        if (lv) { level = lv.getAttribute("data-level"); start(); return; }
        var b = e.target.closest(".mcard");
        if (b) { flip(+b.getAttribute("data-i")); return; }
        if (e.target.id === "mem-restart" || e.target.id === "mem-again") start();
      });
      start();
    })();

    // Game 2: birth order with staggered reveal
    (function () {
      var el = panels.order, pool, chosen, done, lastAdded;
      var sorted = D.figures.slice().sort(function (a, b) { return a.born - b.born; }).map(function (f) { return f.id; });
      var n = D.figures.length;
      function start() { pool = shuffle(ids); chosen = []; done = false; lastAdded = -1; draw(); }
      function draw() {
        var score = 0, slots = "";
        for (var i = 0; i < n; i++) {
          var id = chosen[i], cls = "", txt = '<span class="empty">Tap a name below</span>', style = "";
          if (id) {
            var f = fig(id);
            cls = " filled" + (i === lastAdded ? " pop" : "");
            txt = "<strong>" + f.name + "</strong>";
            if (done) {
              var ok = sorted[i] === id;
              if (ok) score++;
              cls = " filled reveal " + (ok ? "right" : "wrong");
              style = ' style="animation-delay:' + i * 220 + 'ms"';
              txt += '<span class="mono">born ' + f.born + "</span>";
            } else {
              txt += '<span class="mono take">tap to take back</span>';
            }
          }
          slots += '<li class="slot t-' + (id || "none") + cls + '" data-slot="' + i + '"' + style + '><span class="num">' + (i + 1) + '</span><span class="slot-text">' + txt + "</span></li>";
        }
        var chips = pool.filter(function (id) { return chosen.indexOf(id) === -1; }).map(function (id) {
          return '<button type="button" class="chip t-' + id + '" data-id="' + id + '">' + fig(id).name + "</button>";
        }).join("");
        var best = bestGet("sil-order");
        var msg = done ? "You placed " + score + " of " + n + " correctly." : "Tap the people in order of birth, earliest first. " + chosen.length + " of " + n + " placed.";
        el.innerHTML = '<div class="game-bar"><p aria-live="polite" id="ord-msg">' + msg + '</p><div class="hud"><span class="pill soft">Best ' + (best === null ? "none yet" : best + " of " + n) + "</span></div></div>" +
          '<div class="meter" aria-hidden="true"><i style="width:' + (chosen.length / n) * 100 + '%"></i></div>' +
          '<ol class="slots">' + slots + "</ol>" + (chips ? '<div class="chips">' + chips + "</div>" : "") +
          '<div class="game-actions"><button type="button" class="gbtn alt" id="ord-undo"' + (chosen.length && !done ? "" : " disabled") + '>Undo</button><button type="button" class="gbtn" id="ord-reset">' + (done ? "Play again" : "Shuffle") + "</button></div>";
        if (done) {
          var b = bestGet("sil-order");
          if (b === null || score > b) bestSet("sil-order", score);
          if (score === n) setTimeout(function () { confetti(el); }, n * 220);
        }
      }
      el.addEventListener("click", function (e) {
        var chip = e.target.closest(".chip");
        if (chip && !done) { chosen.push(chip.getAttribute("data-id")); lastAdded = chosen.length - 1; if (chosen.length === n) done = true; draw(); return; }
        var slot = e.target.closest(".slot.filled");
        if (slot && !done) { chosen.splice(+slot.getAttribute("data-slot"), 1); lastAdded = -1; draw(); return; }
        if (e.target.id === "ord-undo" && chosen.length && !done) { chosen.pop(); lastAdded = -1; draw(); return; }
        if (e.target.id === "ord-reset") start();
      });
      start();
    })();

    // Game 3: who am I with a blurred portrait, a countdown and streaks
    (function () {
      var el = panels.who, order, r, c, score, streak, bestStreak, picked, left, ti, n = D.figures.length, LIMIT = 20, BLUR = [22, 12, 5];
      function stopT() { if (ti) { clearInterval(ti); ti = null; } }
      function start() { order = shuffle(ids); r = 0; score = 0; streak = 0; bestStreak = 0; round(); }
      function setBlur(px) { var img = byId("who-img"); if (img) img.style.filter = "blur(" + px + "px)"; }
      function addClue(fresh) {
        var id = order[r], li = document.createElement("li");
        li.setAttribute("data-n", c + 1);
        li.textContent = D.clues[id][c];
        if (fresh) li.className = "new";
        byId("who-clues").appendChild(li);
      }
      function hudUpdate() {
        byId("who-score").textContent = "Score " + score;
        var s = byId("who-streak");
        s.textContent = "Streak " + streak;
        s.classList.toggle("hot", streak >= 2);
      }
      function round() {
        stopT();
        if (r >= n) { finish(); return; }
        c = 0; picked = null; left = LIMIT;
        var id = order[r], f = fig(id);
        var btns = D.figures.map(function (g) { return '<button type="button" class="chip t-' + g.id + '" data-id="' + g.id + '">' + g.name + "</button>"; }).join("");
        el.innerHTML = '<div class="game-bar"><p>Round ' + (r + 1) + " of " + n + '</p><div class="hud"><span class="pill" id="who-score"></span><span class="pill" id="who-streak"></span></div></div>' +
          '<div class="who-stage"><div class="who-photo t-' + id + '"><img id="who-img" src="' + id + '.jpg" alt="Blurred portrait" style="object-position:' + f.pos + '"></div>' +
          '<div class="who-side"><div class="timer" aria-hidden="true"><i id="who-bar"></i></div><p class="mono" id="who-left"></p><ol class="clues" id="who-clues"></ol></div></div>' +
          '<div class="chips" id="who-chips">' + btns + '</div><p class="who-result" id="who-result" aria-live="polite"></p>' +
          '<div class="game-actions" id="who-actions"><button type="button" class="gbtn alt" id="who-clue">Another clue</button></div>' +
          '<p class="eyebrow">3 points for one clue, 2 for two, 1 for three. The photo sharpens with each clue.</p>';
        addClue(false); setBlur(BLUR[0]); hudUpdate(); timeUpdate();
        ti = setInterval(function () {
          left = Math.max(0, +(left - 0.1).toFixed(1));
          timeUpdate();
          if (left <= 0) { stopT(); finishRound(null); }
        }, 100);
      }
      function timeUpdate() {
        var bar = byId("who-bar"), l = byId("who-left");
        if (!bar) return;
        bar.style.width = (left / LIMIT) * 100 + "%";
        bar.parentNode.classList.toggle("low", left <= 6);
        l.textContent = Math.ceil(left) + " seconds left";
      }
      function finishRound(pick) {
        stopT();
        picked = pick || "none";
        var id = order[r], f = fig(id), ok = pick === id, pts = ok ? 3 - c : 0;
        score += pts;
        streak = ok ? streak + 1 : 0;
        if (streak > bestStreak) bestStreak = streak;
        Array.prototype.forEach.call(el.querySelectorAll("#who-chips .chip"), function (b) {
          b.disabled = true;
          var g = b.getAttribute("data-id");
          if (g === id) b.classList.add("right"); else if (g === pick) b.classList.add("wrong");
        });
        setBlur(0);
        var img = byId("who-img");
        img.alt = "Portrait of " + f.name;
        img.parentNode.classList.add(ok ? "good" : "bad");
        byId("who-result").textContent = (ok ? "Correct. +" + pts + (pts === 1 ? " point. " : " points. ") : (pick ? "Not quite. " : "Time is up. ") + "It was " + f.name + ". ") + f.known + ".";
        byId("who-actions").innerHTML = '<button type="button" class="gbtn" id="who-next">' + (r === n - 1 ? "See score" : "Next round") + "</button>";
        hudUpdate();
        if (ok && !reduce) { var s = byId("who-score"); s.classList.remove("bump"); void s.offsetWidth; s.classList.add("bump"); }
      }
      function finish() {
        var max = n * 3, best = bestGet("sil-who");
        if (best === null || score > best) bestSet("sil-who", score);
        var title = score >= max * 0.8 ? "Brilliant" : score >= max * 0.5 ? "Well played" : "Keep going";
        el.innerHTML = '<div class="win"><h3>' + title + '</h3><p class="big">' + score + " of " + max + '</p><p>Best streak ' + bestStreak + ". Best score " + Math.max(score, best || 0) + ' of ' + max + '.</p><div class="game-actions" style="justify-content:center"><button type="button" class="gbtn" id="who-restart">Play again</button></div></div>';
        if (score >= max * 0.6) confetti(el);
      }
      el.addEventListener("click", function (e) {
        var chip = e.target.closest("#who-chips .chip");
        if (chip && picked === null) { finishRound(chip.getAttribute("data-id")); return; }
        if (e.target.id === "who-clue" && picked === null && c < 2) {
          c++; addClue(true); setBlur(BLUR[c]);
          if (c >= 2) e.target.disabled = true;
          return;
        }
        if (e.target.id === "who-next") { r++; round(); return; }
        if (e.target.id === "who-restart") start();
      });
      start();
    })();

    // Game 4: age duel, a higher-or-lower style game with lives
    (function () {
      var el = panels.duel, lives, streak, bestRun, pair, kind, locked, last, answeredCount;
      function start() { lives = 3; streak = 0; bestRun = 0; last = ""; answeredCount = 0; next(); }
      function pickPair() {
        var s, key;
        do { s = shuffle(D.figures); key = [s[0].id, s[1].id].sort().join(); } while (key === last);
        last = key;
        return [s[0], s[1]];
      }
      function hearts() {
        var h = "";
        for (var i = 0; i < 3; i++) h += '<span class="heart' + (i < lives ? "" : " lost") + '" id="heart-' + i + '">♥</span>';
        return h;
      }
      function card(f, i) {
        return '<button type="button" class="duel-card t-' + f.id + '" data-i="' + i + '" style="--d:' + i * 120 + 'ms"><img src="' + f.id + '.jpg" alt="Portrait of ' + f.name + '" style="object-position:' + f.pos + '"><span class="duel-name">' + f.name + '</span><span class="duel-role">' + f.country + '</span><span class="duel-val" hidden></span></button>';
      }
      function next() {
        pair = pickPair();
        kind = Math.random() < 0.5 ? "age" : "born";
        locked = false;
        var best = bestGet("sil-duel");
        el.innerHTML = '<div class="game-bar"><p aria-live="polite">' + (kind === "age" ? "Who lived longer?" : "Who was born earlier?") + '</p><div class="hud"><span class="pill hearts" aria-label="' + lives + ' lives left">' + hearts() + '</span><span class="pill" id="duel-streak">Streak ' + streak + '</span><span class="pill soft">Best ' + (best || 0) + "</span></div></div>" +
          '<div class="duel">' + card(pair[0], 0) + '<span class="vs" aria-hidden="true">vs</span>' + card(pair[1], 1) + "</div>" +
          '<p class="who-result" id="duel-result" aria-live="polite"></p><div class="game-actions" id="duel-actions"></div>';
      }
      function valueOf(f) { return kind === "age" ? f.age : f.born; }
      function winnerIndex() {
        var a = valueOf(pair[0]), b = valueOf(pair[1]);
        return kind === "age" ? (a > b ? 0 : 1) : (a < b ? 0 : 1);
      }
      function choose(i) {
        if (locked) return;
        locked = true;
        var win = winnerIndex(), ok = i === win;
        Array.prototype.forEach.call(el.querySelectorAll(".duel-card"), function (b, k) {
          var f = pair[k], v = b.querySelector(".duel-val");
          v.hidden = false;
          b.disabled = true;
          if (kind === "age") countUp(v, f.age, Math.max(1, f.age - 40), " years");
          else countUp(v, f.born, f.born - 150, "", "Born ");
          b.classList.add(k === win ? "right" : "wrong");
          if (k === i) b.classList.add("picked");
        });
        if (ok) { streak++; if (streak > bestRun) bestRun = streak; }
        else { lives--; streak = 0; var h = byId("heart-" + lives); if (h) h.classList.add("lost", "break"); }
        var st = byId("duel-streak");
        st.textContent = "Streak " + streak;
        st.classList.toggle("hot", streak >= 2);
        if (ok) { st.classList.remove("bump"); void st.offsetWidth; st.classList.add("bump"); }
        var w = pair[win], l = pair[1 - win];
        byId("duel-result").textContent = (ok ? "Correct. " : "Not quite. ") + (kind === "age"
          ? w.name + " lived " + w.age + " years and " + l.name + " lived " + l.age + "."
          : w.name + " was born in " + w.born + " and " + l.name + " in " + l.born + ".");
        var best = bestGet("sil-duel");
        if (bestRun > (best || 0)) bestSet("sil-duel", bestRun);
        byId("duel-actions").innerHTML = lives > 0 ? '<button type="button" class="gbtn" id="duel-next">Next duel</button>' : '<button type="button" class="gbtn" id="duel-over">See result</button>';
      }
      function over() {
        el.innerHTML = '<div class="win"><h3>Out of lives</h3><p class="big">Best streak ' + bestRun + '</p><p>Every question had a clear answer, so each streak is a real run of knowledge.</p><div class="game-actions" style="justify-content:center"><button type="button" class="gbtn" id="duel-again">Play again</button></div></div>';
        if (bestRun >= 6) confetti(el);
      }
      el.addEventListener("click", function (e) {
        var b = e.target.closest(".duel-card");
        if (b) { choose(+b.getAttribute("data-i")); return; }
        if (e.target.id === "duel-next") { next(); return; }
        if (e.target.id === "duel-over") { over(); return; }
        if (e.target.id === "duel-again") start();
      });
      start();
    })();
  }
})();
