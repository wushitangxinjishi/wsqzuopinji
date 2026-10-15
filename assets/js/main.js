/* =============================================================================
 *  个人作品集 · 交互逻辑
 *  零依赖原生实现：滚动叙事 / 数据图表 / 手风琴 / 灯箱 / 视频弹层 / 自定义光标
 * ========================================================================== */
(function () {
  "use strict";

  var S = window.SITE || {};
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TOUCH = window.matchMedia("(hover: none)").matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  var ORANGE = "#FF5A00";

  /* ========================================================== 小工具 */

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function seeded(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ========================================================== 出错兜底
   *  content.js 里一旦有语法错误，浏览器会整段跳过它，页面就没有内容可渲染，
   *  看起来就是"一直黑屏打不开"。这里把错误直接显示在页面上，方便定位。
   * ==================================================================== */

  function fatal(title, lines) {
    if (window.__fatalShown) return;
    window.__fatalShown = true;
    document.body.classList.remove("is-loading");

    var root = document.getElementById("preloader");
    if (!root) return;
    root.style.cssText =
      "display:flex;align-items:center;justify-content:center;" +
      "position:fixed;inset:0;z-index:99999;background:#08080A;padding:8vw;";
    root.innerHTML =
      '<div style="max-width:730px;font-family:system-ui,-apple-system,\'Microsoft YaHei\',sans-serif;color:#F2EFEA;">' +
        '<div style="font-family:monospace;font-size:12px;letter-spacing:.22em;color:#FF5A00;margin-bottom:18px;">CONTENT ERROR</div>' +
        '<div style="font-size:24px;font-weight:800;line-height:1.45;margin-bottom:18px;">' + esc(title) + "</div>" +
        (lines || [])
          .filter(function (t) { return t; })
          .map(function (t) {
            return '<p style="font-size:14.5px;line-height:1.95;color:#B6B1AA;margin-bottom:10px;">' + esc(t) + "</p>";
          })
          .join("") +
      "</div>";
  }

  // 脚本报错时（例如 content.js 没执行成功），如果页面还停在加载状态，就把错误显示出来
  window.addEventListener("error", function (e) {
    if (!document.body || !document.body.classList.contains("is-loading")) return;
    fatal("页面脚本出错", [
      e.message || "未知错误",
      e.filename ? "出错位置：" + e.filename.split("/").pop() + " 第 " + e.lineno + " 行" : ""
    ]);
  });

  /* ========================================================== 占位图生成
   *  没有填 src 的作品会显示一张程序生成的抽象占位图（纯 SVG，无需联网）。
   *  放入真实图片后占位图会自动消失。
   * ==================================================================== */

  function placeholder(opts) {
    var w = opts.w || 1200;
    var h = opts.h || 900;
    var label = opts.label || "";
    var sub = opts.sub || "";
    var idx = opts.idx || "";
    var accent = opts.accent || ORANGE;
    var rnd = seeded(hash(label + sub + idx + w + h));
    var base = Math.min(w, h);
    var mono = Math.round(Math.max(13, base * 0.028));

    var blobs = "";
    for (var i = 0; i < 3; i++) {
      var cx = Math.round(rnd() * w);
      var cy = Math.round(rnd() * h);
      var r = Math.round((0.16 + rnd() * 0.24) * base * 1.1);
      var o = (0.050 + rnd() * 0.075).toFixed(3);
      blobs +=
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r +
        '" fill="' + accent + '" opacity="' + o + '"/>';
    }

    var lines = "";
    var step = Math.round(base / 8);
    for (var k = -h; k < w; k += step) {
      lines +=
        '<line x1="' + k + '" y1="0" x2="' + (k + h) + '" y2="' + h +
        '" stroke="#F2EFEA" stroke-opacity="0.035" stroke-width="1"/>';
    }

    var arcs =
      '<circle cx="' + Math.round(w * 0.78) + '" cy="' + Math.round(h * 0.26) +
      '" r="' + Math.round(base * 0.24) + '" fill="none" stroke="' + accent +
      '" stroke-opacity="0.42" stroke-width="1"/>' +
      '<circle cx="' + Math.round(w * 0.78) + '" cy="' + Math.round(h * 0.26) +
      '" r="' + Math.round(base * 0.33) + '" fill="none" stroke="' + accent +
      '" stroke-opacity="0.16" stroke-width="1"/>';

    var bigNo = idx
      ? '<text x="' + (w - Math.round(base * 0.05)) + '" y="' + (h - Math.round(base * 0.05)) +
        '" text-anchor="end" font-family="monospace" font-size="' + Math.round(base * 0.20) +
        '" font-weight="700" fill="none" stroke="#F2EFEA" stroke-opacity="0.14">' + esc(idx) + "</text>"
      : "";

    var pad = Math.round(base * 0.055);

    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
      '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs><radialGradient id="g" cx="30%" cy="20%" r="90%">' +
      '<stop offset="0%" stop-color="#17171C"/><stop offset="100%" stop-color="#0B0B0E"/>' +
      "</radialGradient></defs>" +
      '<rect width="' + w + '" height="' + h + '" fill="url(#g)"/>' +
      blobs + lines + arcs +
      '<rect x="0.5" y="0.5" width="' + (w - 1) + '" height="' + (h - 1) +
      '" fill="none" stroke="#F2EFEA" stroke-opacity="0.12"/>' +
      '<line x1="' + pad + '" y1="' + pad + '" x2="' + (pad + Math.round(base * 0.16)) +
      '" y2="' + pad + '" stroke="' + accent + '" stroke-width="2"/>' +
      '<text x="' + pad + '" y="' + (pad + mono * 2.4) + '" font-family="monospace" ' +
      'font-size="' + mono + '" letter-spacing="' + Math.round(mono * 0.22) + '" fill="' + accent +
      '">' + esc((sub || "PLACEHOLDER").slice(0, 18)) + "</text>" +
      (opts.hint === ""
        ? ""
        : '<text x="' + pad + '" y="' + (h - pad) + '" font-family="monospace" ' +
          'font-size="' + Math.round(mono * 0.92) + '" letter-spacing="' + Math.round(mono * 0.16) +
          '" fill="#7A756F">' + esc(opts.hint || "替换为你的图片") + "</text>") +
      bigNo +
      "</svg>";

    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* ---------------------------------------------------------------- 素材约定
   *  图片：assets/img/01.jpg（对应"图片作品"第 01 张）、me.jpg（个人照片）
   *  视频：assets/video/01.mp4 / .mov / .webm，封面 assets/video/01.jpg
   *  没按约定命名也没关系：在 content.js 里给该条目填 src 即可（优先级最高）。
   *  两者都没有时，才显示占位图。
   * -------------------------------------------------------------------- */
  var IMG_DIR = "assets/img/";
  var VID_DIR = "assets/video/";
  /* 图片只自动探测最常见的两种后缀：候选路径越少，页面上无效的请求就越少。
     其他格式（.jpeg / .webp）在 content.js 里填 src 即可。 */
  var IMG_EXT = [".jpg", ".png"];
  var VID_EXT = [".mp4", ".mov", ".webm"];

  /* 候选路径：content.js 的 src 优先，其次按序号约定的文件名 */
  function imageChain(item, opts) {
    var list = [];
    if (item && item.src) list.push(item.src);
    if (opts && opts.auto) {
      for (var i = 0; i < IMG_EXT.length; i++) list.push(opts.auto + IMG_EXT[i]);
    }
    return list;
  }

  function placeholderFor(item, opts) {
    return placeholder({
      label: item.title || item.name || "",
      sub: (opts && opts.sub) || item.category || item.platform || "",
      idx: opts && opts.idx,
      w: (opts && opts.w) || 1200,
      h: (opts && opts.h) || 900,
      hint: opts && opts.hint,
      accent: (opts && opts.accent) || ORANGE
    });
  }

  /* ---------------------------------------------------------------- 比例工具
   *  ratio 字段支持 "9:16"、"3:4"、"16:9"、"1:1" 这种写法，
   *  也兼容早期的 "tall" / "wide" / "square"。缩略图框按这个比例走，
   *  所以每张图/每个封面都是完整显示、不会被裁切。
   * -------------------------------------------------------------------- */
  function ratioOf(item, fallback) {
    var v = String((item && item.ratio) || "").trim();
    var legacy = { tall: "2:3", wide: "16:10", square: "1:1", vertical: "9:16", landscape: "16:9" };
    if (legacy[v]) v = legacy[v];
    if (/^\d+(\.\d+)?\s*[:/]\s*\d+(\.\d+)?$/.test(v)) return v.replace(":", " / ");
    return fallback || "4 / 5";
  }

  function ratioNumber(ar) {
    var p = String(ar).split("/");
    var a = parseFloat(p[0]);
    var b = parseFloat(p[1] || "1");
    return a > 0 && b > 0 ? a / b : 1;
  }

  /* 占位图按同样比例生成，视觉上才和真实素材一致 */
  function placeholderSize(ar) {
    var r = ratioNumber(ar);
    var w = 1200;
    var h = Math.round(w / r);
    if (h > 2400) { h = 2400; w = Math.round(h * r); }
    if (h < 420) { h = 420; w = Math.round(h * r); }
    return { w: Math.max(420, w), h: h };
  }

  /* 图片加载完成后用素材的真实比例覆盖（以后换图不必改配置）
     maxAR：可选的比例上限（数值 = 宽/高）。视频九宫格里用它保证横版封面
     的卡片不会太矮，从而不在行里留出大片空白。 */
  function fitRatio(box, img, maxAR) {
    if (!img.naturalWidth || !img.naturalHeight) return;
    var r = img.naturalWidth / img.naturalHeight;
    if (maxAR) r = Math.min(r, maxAR);
    box.style.setProperty("--ar", r);
  }

  /* 视频封面框的比例上限：最矮不低于 4:5（0.8） */
  var VIDEO_FRAME_MAX_AR = 0.8;

  /* 从图片路径反推出自动查找的路径（assets/img/xxx.jpg → assets/img/xxx） */
  function hintToAuto(hint) {
    var base = String(hint || "").split("/").pop().replace(/\.[a-z0-9]+$/i, "");
    return base ? IMG_DIR + base : "";
  }

  /* 线性图标（24×24 描边），用于数据分析板块的流程卡片 */
  var ICONS = {
    user: '<circle cx="12" cy="8.2" r="3.5"/><path d="M4.8 20c1.1-3.5 3.9-5.3 7.2-5.3s6.1 1.8 7.2 5.3"/>',
    pen: '<path d="M4 19.6h4.2L19 8.8a2.15 2.15 0 0 0-3-3L5.2 16.6 4 19.6z"/><path d="M14.6 6.4l3 3"/>',
    test: '<rect x="3.6" y="3.6" width="7" height="7" rx="1.6"/><rect x="13.4" y="3.6" width="7" height="7" rx="1.6"/><rect x="3.6" y="13.4" width="7" height="7" rx="1.6"/><path d="M14 17h6M17 14v6"/>',
    rocket: '<path d="M14.2 3.8c2.9 0 6 3.1 6 6-2.5 3.4-5.9 5.4-8.9 6.1l-3.2-3.2c.7-3 2.7-6.4 6.1-8.9z"/><path d="M8.2 16.9c-1.5 1.5-1.6 3.3-2 4.1.8-.4 2.6-.5 4.1-2"/>',
    chat: '<path d="M4 5.6h16v10.2H9.4L4 19.6z"/><path d="M8 9.4h8M8 12.4h5"/>',
    chart: '<path d="M4 4v16h16"/><path d="M8 16.4v-4.2M12.2 16.4V7.6M16.4 16.4v-6"/>',
    loop: '<path d="M4.6 12a7.4 7.4 0 0 1 12.7-5.2"/><path d="M19.4 12a7.4 7.4 0 0 1-12.7 5.2"/><path d="M17.5 3.6v3.4h-3.4M6.5 20.4v-3.4h3.4"/>',
    default: '<circle cx="12" cy="12" r="7.5"/><path d="M12 8.4v7.2M8.4 12h7.2"/>'
  };

  function iconSvg(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.default) + "</svg>";
  }

  /* 按顺序尝试候选路径，全部失败才用占位图兜底 */
  function loadWithFallback(el, list, finalSrc) {
    var queue = list.concat([finalSrc]);
    var i = 0;
    var next = function () {
      if (i >= queue.length) return;
      el.src = queue[i++];
    };
    // 用 onerror 而不是 addEventListener，避免同一个元素反复更换素材时监听器叠加
    el.onerror = next;
    next();
  }

  function makeImage(item, opts) {
    var img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = item.title || item.name || "作品";
    if (opts && opts.onLoad) {
      img.addEventListener("load", function () { opts.onLoad(img); });
    }
    loadWithFallback(img, imageChain(item, opts), placeholderFor(item, opts));
    return img;
  }

  /* ========================================================== 预加载 */

  function runPreloader(done) {
    var root = $("#preloader");
    var nameBox = $("#preloaderName");
    var pct = $("#preloaderPct");
    var bar = $("#preloaderBar");
    var name = (S.profile && S.profile.name) || "Portfolio";
    var latin = (S.profile && S.profile.latin) || "";

    var chars = (name + (latin ? " " + latin : "")).split("");
    nameBox.innerHTML = chars
      .map(function (c, i) {
        var accent = i >= name.length ? " ch--accent" : "";
        return '<span class="ch' + accent + '">' + (c === " " ? "&nbsp;" : esc(c)) + "</span>";
      })
      .join("");

    var step = function (node, i) {
      node.style.transition = "opacity .5s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1)";
      node.style.transitionDelay = (i * 42) + "ms";
      node.style.opacity = "1";
      node.style.transform = "translateY(0)";
    };
    $$(".ch", nameBox).forEach(step);

    var t0 = performance.now();
    var dur = RM ? 200 : 1350;
    var raf;
    var finished = false;

    function tick(now) {
      var p = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      var v = Math.round(eased * 100);
      pct.textContent = pad2(v);
      bar.style.width = v + "%";
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(finish, RM ? 0 : 320);
      }
    }

    function finish() {
      if (finished) return;
      finished = true;
      if (raf) cancelAnimationFrame(raf);

      root.classList.add("is-done");
      root.style.transition = "transform .9s cubic-bezier(.76,0,.24,1), opacity .5s ease";
      root.style.transform = "translateY(-100%)";
      root.style.opacity = "0";
      setTimeout(function () { root.style.display = "none"; }, 950);

      document.body.classList.remove("is-loading");
      var hero = $("#home");
      if (hero) hero.classList.add("is-ready");
      ["#topbar", "#meter"].forEach(function (sel) {
        var n = $(sel);
        if (n) n.classList.add("is-in");
      });
      var rail = $(".rail");
      if (rail) rail.classList.add("is-in");

      if (typeof done === "function") done();
    }

    raf = requestAnimationFrame(tick);
    // 兜底：标签页在后台时 requestAnimationFrame 会被暂停，避免页面一直锁住
    setTimeout(finish, RM ? 600 : 4200);
  }

  /* ========================================================== 结构渲染 */

  function buildChrome() {
    var sections = $$("section[data-nav]").filter(function (s) { return s.id !== "home"; });

    // 顶栏导航
    var top = $("#topbarNav");
    if (top) {
      top.innerHTML = sections
        .map(function (s) {
          var href = "#" + s.id;
          if (s.id === "contact") href = "#contact";
          return '<a href="' + href + '" data-scroll-to="' + s.id + '">' +
            '<span class="nav-idx">' + s.getAttribute("data-index") + "</span>" +
            (s.id === "contact" ? "合作洽谈" : s.getAttribute("data-nav")) + "</a>";
        })
        .join("");
    }

    // 首页底部快链（只放 5 个板块）
    var heroNav = $("#heroNav");
    if (heroNav) {
      heroNav.innerHTML = sections
        .filter(function (s) { return s.id !== "contact"; })
        .map(function (s) {
          return '<a href="#' + s.id + '" data-scroll-to="' + s.id + '">' +
            s.getAttribute("data-nav") + "</a>";
        })
        .join('<span class="sep">/</span>');
    }

    // 页脚导航
    var fnav = $("#footerNav");
    if (fnav) {
      fnav.innerHTML = sections
        .map(function (s) {
          return '<a href="#' + s.id + '" data-scroll-to="' + s.id + '">' +
            (s.id === "contact" ? "合作洽谈" : s.getAttribute("data-nav")) + "</a>";
        })
        .join("");
    }
  }

  function buildHero() {
    var p = S.profile || {};
    $("#brandName").textContent = p.name || "";
    $("#brandRole").textContent = (p.target || p.role || "").split("/")[0].trim();
    $("#heroNameCn").textContent = p.name || "";
    $("#heroNameLatin").textContent = p.latin || "";
    $("#heroRole").textContent = p.role || "";
    $("#heroCity").textContent = p.city || "";
    $("#heroVersion").textContent = p.version || "PORTFOLIO";
    $("#heroHeadline").innerHTML = p.headline || "";
    $("#heroNote").textContent = p.heroNote || "";

    var tags = (p.heroTags || []).concat(p.heroTags || []);
    $("#heroMarquee").innerHTML = tags
      .map(function (t) { return "<span>" + esc(t) + "<i>◆</i></span>"; })
      .join("");

    var soc = $("#heroSocials");
    var links = (p.socials || []).filter(function (s) { return s.href; });
    soc.innerHTML = links
      .map(function (s, i) {
        var sep = i ? '<span class="sep">/</span>' : "";
        return sep + '<a href="' + esc(s.href) + '" target="_blank" rel="noopener noreferrer">' +
          esc(s.label) + "</a>";
      })
      .join("");
    if (!links.length) soc.innerHTML = '<span class="sep">社交链接待填 / social links</span>';

    $("#heroStats").innerHTML = (p.heroStats || [])
      .map(function (s) {
        // 纯数字/短值用大字号，长文本自动降一档，避免把整行撑得失衡
        var isText = String(s.value).replace(/[\d\s.,%+wW]/g, "").length > 2;
        return '<div><b' + (isText ? ' class="is-text"' : "") + ">" + esc(s.value) +
          "</b><span>" + esc(s.label) + "</span></div>";
      })
      .join("");
  }

  function buildAbout() {
    var a = S.about || {};
    $("#aboutProse").innerHTML = (a.paragraphs || [])
      .map(function (t) { return "<p>" + t + "</p>"; })
      .join("");

    $("#aboutFacts").innerHTML = (a.facts || [])
      .map(function (f) { return "<div><dt>" + esc(f.k) + "</dt><dd>" + esc(f.v) + "</dd></div>"; })
      .join("");

    $("#aboutStats").innerHTML = (a.stats || [])
      .map(function (s, i) {
        var dec = s.decimals || 0;
        return '<div><b data-count="' + s.value + '" data-decimals="' + dec +
          '" data-suffix="' + (s.suffix || "") + '">0</b><span>' + esc(s.label) + "</span></div>";
      })
      .join("");

    $("#aboutAccordion").innerHTML = (a.capabilities || [])
      .map(function (g, i) {
        return '<div class="acc-item' + (i === 0 ? " is-open" : "") + '">' +
          '<button class="acc-head" aria-expanded="' + (i === 0) + '">' +
            '<span class="acc-head__idx">' + pad2(i + 1) + "</span>" +
            '<span class="acc-head__title">' + esc(g.title) + "</span>" +
            '<span class="acc-head__note">' + esc(g.note || "") + "</span>" +
            '<span class="acc-head__icon"></span>' +
          "</button>" +
          '<div class="acc-body"><ul class="acc-body__inner">' +
            (g.items || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
          "</ul></div>" +
        "</div>";
      })
      .join("");

    $("#aboutTimeline").innerHTML = (a.timeline || [])
      .map(function (t) {
        return '<div class="tl-item">' +
          '<div class="tl-item__period">' + esc(t.period) + "</div>" +
          '<h3 class="tl-item__title">' + esc(t.title) + "</h3>" +
          '<p class="tl-item__desc">' + esc(t.desc) + "</p>" +
        "</div>";
      })
      .join("");

    // 个人照片：assets/img/me.jpg，或在 content.js 里填 profile.photo
    var portrait = $("#aboutPortrait");
    var pItem = { src: (S.profile && S.profile.photo) || "", title: "个人照片" };
    var pOpts = {
      auto: IMG_DIR + "me", sub: "PHOTO",
      w: 1000, h: 1250, hint: "assets/img/me.jpg"
    };
    loadWithFallback(portrait, imageChain(pItem, pOpts), placeholderFor(pItem, pOpts));
    var cap = $(".portrait__cap");
    if (cap) cap.textContent = "PHOTO / " + ((S.profile && S.profile.name) || "");
  }

  function buildAccounts() {
    var ac = S.accounts || {};
    $("#accountsIntro").innerHTML = ac.intro || "";

    var list = $("#accountList");
    list.innerHTML = (ac.list || [])
      .map(function (it, i) {
        var rows =
          (it.detail && it.detail.do
            ? '<div class="acct__col"><h4>关键动作</h4><ul>' +
              it.detail.do.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
              "</ul></div>"
            : "") +
          (it.detail && it.detail.result
            ? '<div class="acct__col"><h4>结果</h4><ul>' +
              it.detail.result.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
              "</ul></div>"
            : "") +
          (it.detail && it.detail.learn
            ? '<div class="acct__col acct__col--learn"><h4>复盘</h4><p>' + esc(it.detail.learn) + "</p></div>"
            : "");

        var tags = (it.tags || [])
          .map(function (t) { return "<span>" + esc(t) + "</span>"; })
          .join("");

        return '<article class="acct" style="--accent:' + esc(it.accent || ORANGE) + '" ' +
            'data-title="' + esc(it.name) + '" data-platform="' + esc(it.platform) + '" ' +
            'data-meta="' + esc(it.period + " · " + it.delta) + '" data-accent="' + esc(it.accent || ORANGE) + '">' +
          '<button class="acct__head" aria-expanded="false" data-cursor-label="展开">' +
            '<span class="acct__idx">' + pad2(i + 1) + "</span>" +
            '<span class="acct__platform">' + esc(it.platform) + "</span>" +
            '<span class="acct__name">' + esc(it.name) + "</span>" +
            '<span class="acct__period">' + esc(it.period) + "</span>" +
            '<span class="acct__growth"><i>' + esc(it.from) + "</i>" +
              '<svg viewBox="0 0 18 10" aria-hidden="true"><path d="M0 5h14M10 1l4 4-4 4"/></svg>' +
              "<b>" + esc(it.to) + "</b></span>" +
            '<span class="acct__delta">' + esc(it.delta) + "</span>" +
            '<span class="acct__toggle"></span>' +
          "</button>" +
          '<div class="acct__body"><div class="acct__body-inner">' +
            /* 左：账号截图（占 1/3）  右：文字讲解（占 2/3，文字内容不改） */
            '<figure class="acct__media">' +
              '<img class="acct__img" alt="' + esc(it.name) + ' 账号截图" loading="lazy" />' +
              '<figcaption class="acct__cap mono">' +
                esc(IMG_DIR + "account-" + pad2(i + 1) + ".jpg") +
              "</figcaption>" +
            "</figure>" +
            '<div class="acct__text">' + rows +
              (tags ? '<div class="acct__tags">' + tags + "</div>" : "") +
            "</div>" +
          "</div></div>" +
        "</article>";
      })
      .join("");

    /* 账号截图：content.js 填了 src 就用它，否则自动找 assets/img/account-01.jpg / .png */
    $$(".acct", list).forEach(function (node, i) {
      var it = (ac.list || [])[i] || {};
      var media = $(".acct__media", node);
      var img = $(".acct__img", node);
      var cap = $(".acct__cap", node);
      if (!media || !img) return;

      var ar = ratioOf(it, "3 / 4");
      media.style.setProperty("--ar", ar);

      var opts = {
        idx: pad2(i + 1),
        auto: IMG_DIR + "account-" + pad2(i + 1),
        hint: IMG_DIR + "account-" + pad2(i + 1) + ".jpg",
        sub: it.platform || "账号截图",
        w: 900, h: 1200,
        onLoad: function (im) {
          // 比例跟随素材真实比例（上限 4:5，避免横图把框压得太矮）
          fitRatio(media, im, 0.8);
          // 换成真实截图后，角标改为账号信息；仍是占位图则保留文件名提示
          if (im.src.indexOf("data:") !== 0 && cap) {
            cap.textContent = (it.platform ? it.platform + " · " : "") + (it.name || "");
          }
        }
      };
      loadWithFallback(img, imageChain(it, opts), placeholderFor(it, opts));
    });

    $("#accountMethod").innerHTML = (ac.method || [])
      .map(function (m) {
        return '<div class="method__item">' +
          '<div class="method__no">' + esc(m.no) + "</div>" +
          '<h3 class="method__title">' + esc(m.title) + "</h3>" +
          '<p class="method__desc">' + esc(m.desc) + "</p>" +
        "</div>";
      })
      .join("");
  }

  function buildData() {
    var d = S.data || {};
    $("#dataIntro").innerHTML = d.intro || "";

    /* ---------------------------------------------- ① 链路增长闭环模型 */
    var loop = d.loop || {};
    $("#loopTitle").textContent = loop.title || "";
    $("#loopSub").textContent = loop.sub || "";
    $("#loopSteps").innerHTML = (loop.steps || [])
      .map(function (s, i) {
        return '<article class="loop__step">' +
          '<div class="loop__icon">' + iconSvg(s.icon) + "</div>" +
          '<div class="loop__no mono">' + pad2(i + 1) + "</div>" +
          '<h4 class="loop__title">' + esc(s.title) + "</h4>" +
          '<p class="loop__desc">' + esc(s.desc) + "</p>" +
        "</article>";
      })
      .join("");
    $("#loopSummary").textContent = loop.summary || "";

    /* ------------------------------------ ② 内容素材筛选 & 复盘决策漏斗 */
    var fn = d.funnel || {};
    $("#funnelTitle").textContent = fn.title || "";
    var levels = fn.levels || [];
    $("#funnelList").innerHTML = levels
      .map(function (l, i) {
        // 逐级收窄，形成漏斗轮廓：100% → 60%
        var w = levels.length > 1 ? Math.round(100 - (i * 40) / (levels.length - 1)) : 100;
        return '<div class="fun" style="--w:' + w + '%">' +
          '<div class="fun__shape">' +
            '<span class="fun__no mono">' + esc(l.no) + "</span>" +
            '<span class="fun__title">' + esc(l.title) + "</span>" +
            '<span class="fun__sub">' + esc(l.sub) + "</span>" +
          "</div>" +
          '<p class="fun__desc">' + esc(l.desc) + "</p>" +
        "</div>";
      })
      .join("");
    $("#funnelNote").textContent = fn.note || "";

    var fm = fn.media || {};
    var fItem = { title: fm.title || "" };
    var fOpts = {
      auto: hintToAuto(fm.hint || "assets/img/data-hot.jpg"),
      hint: fm.hint || "assets/img/data-hot.jpg",
      sub: "爆款笔记", w: 900, h: 1200
    };
    loadWithFallback($("#funnelImg"), imageChain(fItem, fOpts), placeholderFor(fItem, fOpts));
    $("#funnelCap").textContent = fm.title || "";

    /* -------------------------------------------- ③ 核心监测指标体系 */
    var mt = d.metrics || {};
    $("#metricsTitle").textContent = mt.title || "";
    $("#metricsSub").textContent = mt.sub || "";
    $("#metricsGroups").innerHTML = (mt.groups || [])
      .map(function (g) {
        return '<section class="metric">' +
          '<h4 class="metric__k">' + esc(g.k) + "</h4>" +
          '<ul class="metric__list">' +
            (g.items || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
          "</ul>" +
        "</section>";
      })
      .join("");

    /* ------------------------------------------------ ④ 复盘方法论 */
    var rv = d.review || {};
    $("#reviewTitle").textContent = rv.title || "";
    $("#reviewCard").innerHTML =
      '<p class="review__quote">' + esc(rv.quote || "") + "</p>" +
      '<div class="review__steps">' +
        (rv.steps || [])
          .map(function (s) {
            return '<div class="review__step">' +
              '<span class="review__no mono">' + esc(s.no) + "</span>" +
              '<h4 class="review__title">' + esc(s.title) + "</h4>" +
              '<p class="review__desc">' + esc(s.desc) + "</p>" +
            "</div>";
          })
          .join("") +
      "</div>";

    /* -------------------------------------------- ⑤ 三块看板截图位 */
    var boards = d.boards || [];
    $("#boards").innerHTML = boards
      .map(function (b, i) {
        return '<figure class="board">' +
          '<div class="board__media"><img data-i="' + i + '" alt="' + esc(b.title) + '" loading="lazy" /></div>' +
          '<figcaption class="board__body">' +
            '<h4 class="board__title">' + esc(b.title) + "</h4>" +
            (b.desc ? '<p class="board__desc">' + esc(b.desc) + "</p>" : "") +
          "</figcaption>" +
        "</figure>";
      })
      .join("");

    $$(".board__media img", $("#boards")).forEach(function (img) {
      var i = +img.getAttribute("data-i");
      var b = boards[i] || {};
      var item = { title: b.title || "" };
      var opts = {
        auto: hintToAuto(b.hint),
        hint: b.hint || "",
        sub: "数据看板", w: 1600, h: 1000
      };
      loadWithFallback(img, imageChain(item, opts), placeholderFor(item, opts));
    });
  }

  /* 折线图 SVG */
  function lineChart(cfg) {
    var W = 1000, H = 320, padL = 46, padR = 30, padT = 26, padB = 44;
    var vals = cfg.values;
    var n = vals.length;
    var max = Math.max.apply(null, vals) * 1.18;
    var x = function (i) { return padL + (i * (W - padL - padR)) / (n - 1); };
    var y = function (v) { return padT + (1 - v / max) * (H - padT - padB); };
    var pts = vals.map(function (v, i) { return [x(i), y(v)]; });

    var path = "M " + pts[0][0].toFixed(2) + " " + pts[0][1].toFixed(2);
    for (var i = 1; i < pts.length; i++) {
      var p0 = pts[i - 1], p1 = pts[i];
      var cx = (p1[0] - p0[0]) * 0.42;
      path += " C " + (p0[0] + cx).toFixed(2) + " " + p0[1].toFixed(2) + ", " +
        (p1[0] - cx).toFixed(2) + " " + p1[1].toFixed(2) + ", " +
        p1[0].toFixed(2) + " " + p1[1].toFixed(2);
    }
    var area = path + " L " + x(n - 1).toFixed(2) + " " + (H - padB) +
      " L " + padL + " " + (H - padB) + " Z";

    // 网格 + Y 轴刻度
    var grid = "";
    for (var t = 0; t <= 4; t++) {
      var gy = padT + (t * (H - padT - padB)) / 4;
      var gv = (max * (1 - t / 4)).toFixed(1).replace(/\.0$/, "");
      grid += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - padR) +
        '" y2="' + gy.toFixed(1) + '"/>' +
        '<text x="' + (padL - 12) + '" y="' + (gy + 3).toFixed(1) +
        '" text-anchor="end">' + gv + "</text>";
    }

    // X 轴标签
    var axis = (cfg.labels || [])
      .map(function (lb, i) {
        return '<text x="' + x(i).toFixed(1) + '" y="' + (H - padB + 22) +
          '" text-anchor="middle">' + esc(lb) + "</text>";
      })
      .join("");

    var dots = "";
    if (n <= 16) {
      dots = pts
        .map(function (p, i) {
          return '<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) +
            '" r="3.2" style="transition-delay:' + (300 + i * 90) + 'ms"/>';
        })
        .join("");
    }

    // 峰值标记
    var maxIdx = vals.indexOf(Math.max.apply(null, vals));
    var peak =
      '<circle class="chart__peak" cx="' + x(maxIdx).toFixed(2) + '" cy="' +
      y(vals[maxIdx]).toFixed(2) + '" r="5"/>' +
      '<text class="chart__peak-label" x="' + x(maxIdx).toFixed(2) + '" y="' +
      (y(vals[maxIdx]) - 16).toFixed(2) + '" text-anchor="middle">峰值 ' + vals[maxIdx] +
      (cfg.unit || "") + "</text>";

    // hover 热区
    var colW = (W - padL - padR) / (n - 1);
    var zones = pts
      .map(function (p, i) {
        return '<rect class="chart__hover" x="' + (p[0] - colW / 2).toFixed(1) +
          '" y="' + padT + '" width="' + colW.toFixed(1) + '" height="' + (H - padT - padB) +
          '" data-i="' + i + '"/>';
      })
      .join("");

    return (
      '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet" role="img" ' +
        'aria-label="' + esc(cfg.title || "数据曲线") + '">' +
        "<defs><linearGradient id=\"areaGrad\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">" +
          '<stop offset="0%" stop-color="' + ORANGE + '" stop-opacity="0.34"/>' +
          '<stop offset="100%" stop-color="' + ORANGE + '" stop-opacity="0"/>' +
        "</linearGradient></defs>" +
        '<g class="chart__grid">' + grid + "</g>" +
        '<path class="chart__area" d="' + area + '"/>' +
        '<path class="chart__line" d="' + path + '"/>' +
        '<g class="chart__dots">' + dots + "</g>" +
        peak +
        '<g class="chart__axis">' + axis + "</g>" +
        "<g>" + zones + "</g>" +
      "</svg>" +
      '<div class="chart__tooltip" id="growthTip"></div>'
    );
  }

  /* 折线图交互 */
  function bindChart() {
    var wrap = $("#growthChart");
    if (!wrap) return;
    var svg = $("svg", wrap);
    var tip = $("#growthTip");
    var path = $(".chart__line", wrap);
    var g = S.data && S.data.growth;
    if (!svg || !g) return;

    // 线条长度 → 描边动画
    if (path && path.getTotalLength) {
      try {
        // 只设置长度变量，dasharray / dashoffset 交给 CSS 控制，才能触发描边动画
        path.style.setProperty("--len", Math.ceil(path.getTotalLength()));
      } catch (e) { /* ignore */ }
    }

    if (TOUCH) return;

    $$(".chart__hover", wrap).forEach(function (z) {
      z.addEventListener("pointerenter", function () {
        var i = +z.getAttribute("data-i");
        var v = g.values[i];
        var rect = svg.getBoundingClientRect();
        var cx = ((z.getAttribute("x") * 1 + (parseFloat(z.getAttribute("width")) / 2)) / 1000) * rect.width;
        var cy = 0;
        var pts = $$(".chart__dots circle", wrap)[i];
        if (pts) {
          cy = ((parseFloat(pts.getAttribute("cy"))) / 320) * rect.height;
        }
        tip.textContent = (g.labels[i] || "") + " · " + v + (g.unit || "");
        tip.style.left = cx + "px";
        tip.style.top = cy + "px";
        tip.style.opacity = "1";
      });
    });
    svg.addEventListener("pointerleave", function () { tip.style.opacity = "0"; });
  }

  function buildWorks() {
    var wk = S.works || {};
    $("#worksIntro").innerHTML = wk.intro || "";

    var items = wk.items || [];
    var counts = {};
    var order = [];
    items.forEach(function (i) {
      var c = i.category || "未分类";
      if (!counts[c]) { counts[c] = 0; order.push(c); }
      counts[c]++;
    });

    // 分类标签：content.js 里 filters 的顺序优先，其余分类按作品出现顺序自动补上，
    // 所以不会出现"点了没内容"的空标签
    var used = [];
    (wk.filters || []).forEach(function (f) {
      if (f !== "全部" && counts[f] && used.indexOf(f) < 0) used.push(f);
    });
    order.forEach(function (c) { if (used.indexOf(c) < 0) used.push(c); });

    $("#worksFilters").innerHTML = ["全部"].concat(used)
      .map(function (f, i) {
        var n = f === "全部" ? items.length : counts[f];
        return '<button class="filter' + (i === 0 ? " is-active" : "") + '" data-filter="' +
          esc(f) + '">' + esc(f) + "<span>" + pad2(n) + "</span></button>";
      })
      .join("");

    $("#worksGallery").innerHTML = items
      .map(function (it, i) {
        return '<article class="gitem" data-cat="' + esc(it.category || "未分类") + '" data-i="' + i +
          '" data-cursor-label="查看">' +
          '<span class="gitem__idx">' + pad2(i + 1) + "</span>" +
          '<div class="gitem__media"></div>' +
          '<span class="gitem__plus" aria-hidden="true"><svg viewBox="0 0 14 14"><path d="M7 1v12M1 7h12"/></svg></span>' +
          '<div class="gitem__overlay">' +
            '<span class="gitem__cat">' + esc(it.category) + "</span>" +
            '<h3 class="gitem__title">' + esc(it.title) + "</h3>" +
          "</div>" +
        "</article>";
      })
      .join("");

    // 塞入图片（占位图按比例生成）
    $$(".gitem", $("#worksGallery")).forEach(function (node) {
      var i = +node.getAttribute("data-i");
      var it = items[i];
      var media = $(".gitem__media", node);
      var ar = ratioOf(it, "4 / 5");
      var size = placeholderSize(ar);
      media.style.setProperty("--ar", ar);
      media.appendChild(makeImage(it, {
        idx: pad2(i + 1),
        auto: IMG_DIR + pad2(i + 1),
        hint: IMG_DIR + pad2(i + 1) + ".jpg",
        w: size.w,
        h: size.h,
        onLoad: function (img) { fitRatio(media, img); }
      }));
    });
  }

  function buildVideo() {
    var vd = S.video || {};
    $("#videoIntro").innerHTML = vd.intro || "";
    $("#videoRoles").innerHTML = (vd.roles || [])
      .map(function (r) { return "<span>" + esc(r) + "</span>"; })
      .join("");

    var items = vd.items || [];
    $("#videoList").innerHTML = items
      .map(function (it, i) {
        var meta = "";
        if (it.platform) meta += "<span>" + esc(it.platform) + "</span>";
        if (it.views) meta += "<span>播放 <b>" + esc(it.views) + "</b></span>";
        if (it.rate) meta += "<span>完播 <b>" + esc(it.rate) + "</b></span>";
        if (it.role) meta += '<span class="tag">' + esc(it.role) + "</span>";

        return '<button class="vitem" data-reveal data-i="' + i + '" data-cursor-label="播放">' +
          '<div class="vitem__poster">' +
            '<span class="vitem__play" aria-hidden="true">' +
              '<svg viewBox="0 0 16 16"><path d="M2 1.5v13l12-6.5z"/></svg>' +
            "</span>" +
            (it.duration ? '<span class="vitem__dur">' + esc(it.duration) + "</span>" : "") +
          "</div>" +
          '<div class="vitem__body">' +
            '<h3 class="vitem__title">' + esc(it.title) + "</h3>" +
            (it.desc ? '<p class="vitem__desc">' + esc(it.desc) + "</p>" : "") +
            (meta ? '<div class="vitem__meta">' + meta + "</div>" : "") +
          "</div>" +
        "</button>";
      })
      .join("");

    $$(".vitem", $("#videoList")).forEach(function (node) {
      var i = +node.getAttribute("data-i");
      var it = items[i];
      var poster = $(".vitem__poster", node);
      // 横版封面框最矮不低于 4:5，避免整行出现大片空白；封面本身仍按原比例完整居中
      var ar = Math.min(ratioNumber(ratioOf(it, "9 / 16")), VIDEO_FRAME_MAX_AR);
      var size = placeholderSize(ar);
      poster.style.setProperty("--ar", ar);
      poster.insertBefore(makeImage(it, {
        idx: pad2(i + 1), w: size.w, h: size.h,
        auto: VID_DIR + pad2(i + 1),
        hint: VID_DIR + pad2(i + 1) + ".jpg",
        onLoad: function (img) { fitRatio(poster, img, VIDEO_FRAME_MAX_AR); }
      }), poster.firstChild);
    });
  }

  function buildOutro() {
    var c = S.contact || {};
    var p = S.profile || {};
    $("#outroKicker").textContent = c.kicker || "CONTACT";
    $("#outroHeadline").innerHTML = c.headline || "";
    $("#outroLines").innerHTML = (c.lines || [])
      .map(function (t) { return "<p>" + t + "</p>"; })
      .join("");
    $("#outroFacts").innerHTML = (c.facts || [])
      .map(function (f) { return "<div><dt>" + esc(f.k) + "</dt><dd>" + esc(f.v) + "</dd></div>"; })
      .join("");

    var mail = $("#outroMail");
    mail.href = "mailto:" + (p.email || "");
    $(".mailto__text", mail).textContent = p.email || "";

    var links = (p.socials || []).filter(function (s) { return s.href; });
    var extra = [];
    if (p.wechat) extra.push({ label: "微信 · " + p.wechat, href: "" });
    if (p.phone) extra.push({ label: "电话 · " + p.phone, href: "" });
    $("#outroSocials").innerHTML = links.concat(extra)
      .map(function (s, i) {
        return s.href
          ? '<a href="' + esc(s.href) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + "</a>"
          : '<a href="#contact" data-scroll-to="contact" data-static="1">' + esc(s.label) + "</a>";
      })
      .join("");

    $("#footerMail").textContent = p.email || "";
    $("#footerMail").href = "mailto:" + (p.email || "");
    $("#footerWechat").textContent = p.wechat || "";
    $("#footerName").textContent = p.name || "";
    $("#footerYear").textContent = new Date().getFullYear();

    document.title = (p.name ? p.name + " · " : "") + (p.siteTitle || p.role || "运营作品集");

    // 未绑定链接的社交按钮不跳动
    $$('#outroSocials a[data-static="1"]').forEach(function (a) {
      a.removeAttribute("href");
      a.removeAttribute("data-scroll-to");
      a.style.cursor = "default";
    });
  }

  /* ========================================================== 交互绑定 */

  function observeReveals() {
    var nodes = $$("[data-reveal]");
    if (!("IntersectionObserver" in window) || RM) {
      nodes.forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          // 触发内部图表动画
          $$(".bar", e.target).forEach(function (b) { b.classList.add("is-in"); });
          io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );
    nodes.forEach(function (n) { io.observe(n); });

    // 图表卡片 / 数据卡单独观察
    $$(".card, .bar, .donut").forEach(function (n) { io.observe(n); });
  }

  function bindStatements() {
    var map = {
      about: S.about, accounts: S.accounts, data: S.data,
      works: S.works, video: S.video
    };
    $$("[data-statement]").forEach(function (n) {
      var cfg = map[n.getAttribute("data-statement")];
      if (cfg && cfg.statement) n.innerHTML = cfg.statement;
    });
  }

  function bindAccordions() {
    function setOpen(item, open) {
      var body = $(".acc-body", item);
      var head = $(".acc-head", item);
      if (!body) return;
      if (open) {
        item.classList.add("is-open");
        head.setAttribute("aria-expanded", "true");
        body.style.height = body.scrollHeight + "px";
      } else {
        item.classList.remove("is-open");
        head.setAttribute("aria-expanded", "false");
        body.style.height = body.scrollHeight + "px";
        requestAnimationFrame(function () { body.style.height = "0px"; });
      }
    }

    $$(".acc-item").forEach(function (item) {
      var head = $(".acc-head", item);
      if (!head) return;
      if (item.classList.contains("is-open")) {
        var b = $(".acc-body", item);
        b.style.height = "auto";
      }
      head.addEventListener("click", function () {
        var isOpen = item.classList.contains("is-open");
        $$(".acc-item.is-open").forEach(function (o) { setOpen(o, false); });
        if (!isOpen) setOpen(item, true);
      });
    });

    // 窗口变化时重算已展开高度
    window.addEventListener("resize", function () {
      $$(".acc-item.is-open .acc-body").forEach(function (b) {
        b.style.height = "auto";
      });
    });
  }

  function bindAccounts() {
    function setOpen(node, open) {
      var body = $(".acct__body", node);
      var head = $(".acct__head", node);
      if (!body) return;
      head.setAttribute("data-cursor-label", open ? "收起" : "展开");
      if (open) {
        node.classList.add("is-open");
        head.setAttribute("aria-expanded", "true");
        body.style.height = body.scrollHeight + "px";
      } else {
        node.classList.remove("is-open");
        head.setAttribute("aria-expanded", "false");
        body.style.height = body.scrollHeight + "px";
        requestAnimationFrame(function () { body.style.height = "0px"; });
      }
    }

    $$(".acct").forEach(function (node) {
      var head = $(".acct__head", node);
      head.addEventListener("click", function () {
        var isOpen = node.classList.contains("is-open");
        $$(".acct.is-open").forEach(function (o) { setOpen(o, false); });
        setOpen(node, !isOpen);
      });
    });
  }

  function bindFilters() {
    var gallery = $("#worksGallery");
    if (!gallery) return;
    var current = "全部";

    function apply(f) {
      current = f;
      $$(".gitem", gallery).forEach(function (n) {
        var match = f === "全部" || n.getAttribute("data-cat") === f;
        n.classList.add("is-out");
        setTimeout(function () {
          n.classList.toggle("is-hidden", !match);
          requestAnimationFrame(function () { n.classList.remove("is-out"); });
        }, RM ? 0 : 200);
      });
    }

    $$(".filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var f = btn.getAttribute("data-filter");
        if (f === current) return;
        $$(".filter").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        apply(f);
      });
    });

    return function () {
      return $$(".gitem:not(.is-hidden)", gallery).map(function (n) {
        return +n.getAttribute("data-i");
      });
    };
  }

  /* ---- 灯箱 ---- */
  function initLightbox(visibleIds) {
    var box = $("#lightbox");
    var img = $("#lightboxImg");
    var items = (S.works && S.works.items) || [];
    var current = 0;

    function render(i) {
      var ids = visibleIds();
      if (!ids.length) return;
      current = (i + ids.length) % ids.length;
      var idx = ids[current];
      var it = items[idx] || {};
      var opts = {
        auto: IMG_DIR + pad2(idx + 1),
        hint: IMG_DIR + pad2(idx + 1) + ".jpg",
        w: 1600, h: 1200
      };
      loadWithFallback(img, imageChain(it, opts), placeholderFor(it, opts));
      img.alt = it.title || "";
      $("#lightboxCat").textContent = it.category || "";
      $("#lightboxTitle").textContent = it.title || "";
      $("#lightboxDesc").textContent = it.desc || "";
      $("#lightboxCount").textContent = pad2(current + 1) + " / " + pad2(ids.length);
    }

    function open(i) {
      render(i);
      box.classList.add("is-open");
      document.body.classList.add("is-locked");
    }
    function close() {
      box.classList.remove("is-open");
      document.body.classList.remove("is-locked");
    }

    $$(".gitem").forEach(function (n) {
      n.addEventListener("click", function () {
        var ids = visibleIds();
        var pos = ids.indexOf(+n.getAttribute("data-i"));
        open(pos < 0 ? 0 : pos);
      });
    });

    $("#lightboxClose").addEventListener("click", close);
    $("#lightboxPrev").addEventListener("click", function () { render(current - 1); });
    $("#lightboxNext").addEventListener("click", function () { render(current + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });

    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") render(current - 1);
      if (e.key === "ArrowRight") render(current + 1);
    });
  }

  /* ---- 视频弹层 ---- */
  function initVideoModal() {
    var box = $("#vmodal");
    var player = $("#vmodalPlayer");
    var empty = $("#vmodalEmpty");
    var items = (S.video && S.video.items) || [];

    function open(i) {
      var it = items[i] || {};
      player.innerHTML = "";
      player.classList.remove("is-on");
      empty.classList.remove("is-on");

      if (it.embed) {
        // 外链播放（B站 / YouTube 的 iframe 地址）
        var f = document.createElement("iframe");
        f.src = it.embed;
        f.allow = "autoplay; fullscreen; picture-in-picture";
        f.allowFullscreen = true;
        f.setAttribute("scrolling", "no");
        f.setAttribute("frameborder", "0");
        player.appendChild(f);
        player.classList.add("is-on");
      } else {
        // 本地视频：content.js 的 src 优先，否则按 assets/video/01.mp4 这种约定找
        var cands = it.src
          ? [it.src]
          : VID_EXT.map(function (ext) { return VID_DIR + pad2(i + 1) + ext; });
        var v = document.createElement("video");
        v.controls = true;
        v.autoplay = true;
        v.playsInline = true;

        var k = 0;
        v.onerror = function () {
          if (k < cands.length) {
            v.src = cands[k++];
          } else {
            player.innerHTML = "";
            player.classList.remove("is-on");
            empty.classList.add("is-on");
          }
        };
        v.src = cands[k++];

        player.appendChild(v);
        player.classList.add("is-on");
      }

      $("#vmodalTitle").textContent = it.title || "";
      var vdesc = $("#vmodalDesc");
      if (vdesc) {
        vdesc.textContent = it.desc || "";
        vdesc.style.display = it.desc ? "" : "none";
      }
      $("#vmodalStats").innerHTML = [
        ["平台", it.platform],
        ["时长", it.duration],
        ["播放量", it.views],
        ["完播率", it.rate],
        ["我的角色", it.role]
      ]
        .filter(function (r) { return r[1]; })
        .map(function (r) { return "<li>" + r[0] + " <b>" + esc(r[1]) + "</b></li>"; })
        .join("");

      box.classList.add("is-open");
      document.body.classList.add("is-locked");
    }

    function close() {
      box.classList.remove("is-open");
      document.body.classList.remove("is-locked");
      setTimeout(function () { player.innerHTML = ""; }, 400);
    }

    $$(".vitem").forEach(function (n) {
      n.addEventListener("click", function () { open(+n.getAttribute("data-i")); });
    });

    $("#vmodalClose").addEventListener("click", close);
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && box.classList.contains("is-open")) close();
    });
  }

  /* ---- 悬浮预览卡 ---- */
  function initHovercard() {
    if (TOUCH || RM) return;
    var card = $("#hovercard");
    var x = 0, y = 0, tx = 0, ty = 0, on = false;

    function loop() {
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      card.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%) scale(" +
        (on ? 1 : 0.94) + ")";
      requestAnimationFrame(loop);
    }
    loop();

    $$(".acct").forEach(function (node) {
      node.addEventListener("pointerenter", function () {
        var accent = node.getAttribute("data-accent") || ORANGE;
        card.innerHTML =
          '<div class="hovercard__media"></div>' +
          '<div class="hovercard__row"><span>' + esc(node.getAttribute("data-platform")) +
          "</span><b>点击展开</b></div>" +
          '<div class="hovercard__row"><span>' + esc(node.getAttribute("data-meta")) + "</span></div>";
        var media = $(".hovercard__media", card);
        media.appendChild(makeImage(
          { title: node.getAttribute("data-title"), category: node.getAttribute("data-platform") },
          { w: 800, h: 600, accent: accent, hint: "" }
        ));
        on = true;
        card.classList.add("is-on");
      });
      node.addEventListener("pointerleave", function () {
        on = false;
        card.classList.remove("is-on");
      });
    });

    document.addEventListener("pointermove", function (e) {
      var w = card.offsetWidth || 260;
      tx = Math.min(e.clientX + 130, window.innerWidth - w / 2 - 16);
      tx = Math.max(tx, w / 2 + 16);
      ty = e.clientY;
    });
  }

  /* ---- 自定义光标 ---- */
  function initCursor() {
    if (TOUCH || RM) return;
    var cur = $("#cursor");
    var label = $("#cursorLabel");
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my;
    var vis = false;

    document.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      $("#cursor").style.transform = "translate(" + mx + "px," + my + "px)";
      if (!vis) { vis = true; cur.classList.add("is-on"); }
    });

    document.addEventListener("pointerdown", function () {
      center.style.transform = "scale(0.7)";
    });

    var center = $(".cursor__dot", cur);
    document.addEventListener("pointerup", function () {
      if (center) center.style.transform = "scale(1)";
    });

    function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      var ring = $(".cursor__ring", cur);
      if (ring) ring.style.transform = "translate(" + (rx - mx) + "px," + (ry - my) + "px)";
      requestAnimationFrame(loop);
    }
    loop();

    document.addEventListener("pointerover", function (e) {
      var t = e.target.closest ? e.target.closest("a, button, [data-cursor-label]") : null;
      if (!t) { cur.classList.remove("is-hover"); return; }
      var custom = t.getAttribute("data-cursor-label");
      cur.classList.add("is-hover");
      if (custom) {
        cur.classList.add("is-label");
        label.textContent = custom;
      } else {
        cur.classList.remove("is-label");
        label.textContent = "";
      }
    });
  }

  /* ---- 滚动计量 / 高亮 / 视差 ---- */
  function initScroll() {
    var bar = $("#meterBar");
    var num = $("#meterNum");
    var lbl = $("#meterLabel");
    var topbar = $("#topbar");
    var sections = $$("section[data-nav]");
    var raf = null;

    function frame() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 8 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      if (bar) bar.style.width = (p * 100).toFixed(2) + "%";
      if (num) num.textContent = pad2(Math.round(p * 100));

      if (topbar) topbar.classList.toggle("is-solid", window.scrollY > 60);

      // 当前板块
      var mid = window.scrollY + window.innerHeight * 0.35;
      var act = sections[0];
      sections.forEach(function (s) {
        if (s.offsetTop <= mid) act = s;
      });
      if (act && lbl) lbl.textContent = act.getAttribute("data-nav");
      $$(".topbar__nav a").forEach(function (a) {
        a.classList.toggle("is-active", act && a.getAttribute("data-scroll-to") === act.id);
      });

      // 视差
      $$("[data-parallax]").forEach(function (n) {
        var amt = parseFloat(n.getAttribute("data-parallax")) || 0;
        n.style.transform = "translate3d(0," + (window.scrollY * amt).toFixed(1) + "px,0)";
      });

      raf = null;
    }

    window.addEventListener(
      "scroll",
      function () { if (!raf) raf = requestAnimationFrame(frame); },
      { passive: true }
    );
    window.addEventListener("resize", frame);
    frame();
  }

  /* ---- 计数器 ---- */
  function initCounters() {
    var nodes = $$("[data-count]");
    if (!nodes.length) return;

    function run(n) {
      var to = parseFloat(n.getAttribute("data-count")) || 0;
      var dec = parseInt(n.getAttribute("data-decimals") || "0", 10);
      var suffix = n.getAttribute("data-suffix") || "";
      if (RM) { n.textContent = to.toFixed(dec) + suffix; return; }
      var dur = 1500;
      var t0 = performance.now();
      function tick(now) {
        var p = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        n.textContent = (to * e).toFixed(dec) + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else n.textContent = to.toFixed(dec) + suffix;
      }
      requestAnimationFrame(tick);
    }

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(run);
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          run(e.target);
          io.unobserve(e.target);
        });
      },
      { threshold: 0.4 }
    );
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---- 平滑滚动 ---- */
  function initSmoothScroll() {
    var animating = false;

    function tween(targetY) {
      if (RM) { window.scrollTo(0, targetY); return; }
      var startY = window.scrollY;
      var dist = targetY - startY;
      if (Math.abs(dist) < 4) return;
      var dur = Math.min(1300, Math.max(620, Math.abs(dist) * 0.42));
      var t0 = performance.now();
      animating = true;

      function tick(now) {
        if (!animating) return;
        var p = Math.min(1, (now - t0) / dur);
        var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo(0, startY + dist * e);
        if (p < 1) requestAnimationFrame(tick);
        else animating = false;
      }
      requestAnimationFrame(tick);
    }

    ["wheel", "touchstart", "keydown"].forEach(function (evt) {
      window.addEventListener(evt, function () { animating = false; }, { passive: true });
    });

    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("[data-scroll-to]") : null;
      if (!a) return;
      var id = a.getAttribute("data-scroll-to");
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      tween(target.getBoundingClientRect().top + window.scrollY);
      history.replaceState(null, "", "#" + id);
    });
  }

  /* ========================================================== 启动 */

  function boot() {
    if (!S || !S.profile || !S.works || !S.video || !S.accounts) {
      fatal("读取不到站点内容（window.SITE）", [
        "assets/js/content.js 没有被成功执行。最常见的原因是这个文件里有一个语法错误 —— 多写或少写了一个逗号、引号没有配对、括号没有闭合。",
        "排查方法：在这个页面按 F12 打开开发者工具，切到 Console 面板，第一条红字会直接指出出错的文件和行号。",
        "修好之后刷新页面即可恢复。"
      ]);
      return;
    }

    try {
      buildChrome();
      buildHero();
      buildAbout();
      buildAccounts();
      buildData();
      buildWorks();
      buildVideo();
      buildOutro();

      bindStatements();
      bindAccordions();
      bindAccounts();
      var visibleIds = bindFilters();
      observeReveals();
      initCounters();
      initLightbox(visibleIds || function () {
        return $$(".gitem").map(function (n) { return +n.getAttribute("data-i"); });
      });
      initVideoModal();
      initHovercard();
      initCursor();
      initScroll();
      initSmoothScroll();
      bindChart();

      document.querySelectorAll('a[href="#"]').forEach(function (a) {
        if (!a.getAttribute("data-scroll-to")) {
          a.addEventListener("click", function (e) { e.preventDefault(); });
        }
      });
    } catch (err) {
      fatal("内容渲染失败", [
        (err && err.message) || String(err),
        "通常是 assets/js/content.js 里某个字段的写法有问题（比如括号没闭合、少了引号）。",
        "按 F12 看 Console 面板的第一条红字，会指出具体位置。"
      ]);
      return;
    }

    runPreloader();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
