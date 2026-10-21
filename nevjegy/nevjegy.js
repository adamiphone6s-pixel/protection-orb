/* Digitális névjegy: megjelenítés, vCard-mentés, QR-kód, megosztás, NFC-matrica írása. */
(function () {
  "use strict";
  const d = window.NEVJEGY || {};
  const $ = (id) => document.getElementById(id);
  const fullName = [d.vezeteknev, d.keresztnev].filter(Boolean).join(" ");
  const cardUrl = d.link || location.origin + location.pathname;

  const ICONS = {
    tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    mail: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
    web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    chat: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>'
  };

  function el(tag, attrs, html) {
    const n = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  // Csak http(s), mailto és tel linkeket engedünk az adatokból.
  function safeUrl(u) {
    return /^(https?:|mailto:|tel:)/i.test(u) ? u : "#";
  }

  /* ---------- Megjelenítés ---------- */
  function render() {
    document.title = fullName ? fullName + " — névjegy" : "Névjegy";
    $("name").textContent = fullName;
    $("role").textContent = [d.titulus, d.ceg].filter(Boolean).join(" · ");
    $("bio").textContent = d.bemutatkozas || "";

    const av = $("avatar");
    if (d.foto) {
      const img = el("img", { src: d.foto, alt: "" });
      img.onerror = () => { av.textContent = initials(); };
      av.appendChild(img);
    } else {
      av.textContent = initials();
    }

    const rows = [];
    if (d.telefon) rows.push(["tel", "Telefon", d.telefon, "tel:" + d.telefon.replace(/[^\d+]/g, "")]);
    if (d.email) rows.push(["mail", "E-mail", d.email, "mailto:" + d.email]);
    if (d.whatsapp) rows.push(["chat", "WhatsApp", "Üzenet küldése", "https://wa.me/" + d.whatsapp.replace(/\D/g, "")]);
    if (d.web) rows.push(["web", "Weboldal", d.web.replace(/^https?:\/\//, "").replace(/\/$/, ""), d.web]);
    if (d.cim) rows.push(["pin", "Cím", d.cim, "https://maps.google.com/?q=" + encodeURIComponent(d.cim)]);
    const actions = $("actions");
    rows.forEach(([icon, label, value, href]) => {
      const ext = /^https?:/.test(href);
      actions.appendChild(el("a", Object.assign({ class: "action", href: safeUrl(href) }, ext ? { target: "_blank", rel: "noopener" } : {}),
        '<span class="action-icon"><svg viewBox="0 0 24 24">' + ICONS[icon] + "</svg></span>" +
        '<span class="action-text"><span class="action-label">' + esc(label) + '</span><span class="action-value">' + esc(value) + "</span></span>"));
    });

    const links = $("links");
    (d.linkek || []).filter((l) => l && l.url).forEach((l) => {
      links.appendChild(el("a", { class: "link", href: safeUrl(l.url), target: "_blank", rel: "noopener" }, esc(l.nev || l.url)));
    });
  }
  function initials() {
    return ((d.vezeteknev || "")[0] || "") + ((d.keresztnev || "")[0] || "") || "?";
  }

  /* ---------- vCard ---------- */
  function vEsc(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  }
  // A vCard sorai legfeljebb 75 bájtosak lehetnek; a hosszabbakat szóközzel kezdett sorokban folytatjuk.
  function fold(line) {
    const out = [];
    let cur = "", bytes = 0;
    for (const ch of line) {
      const b = new TextEncoder().encode(ch).length;
      if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join("\r\n ");
  }
  async function photoBase64() {
    if (!d.foto) return null;
    try {
      const blob = await (await fetch(d.foto)).blob();
      if (!/^image\/(jpeg|png)$/.test(blob.type) || blob.size > 400000) return null;
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return { type: blob.type === "image/png" ? "PNG" : "JPEG", data: btoa(bin) };
    } catch (e) {
      return null;
    }
  }
  async function buildVCard() {
    const L = ["BEGIN:VCARD", "VERSION:3.0",
      "N:" + vEsc(d.vezeteknev || "") + ";" + vEsc(d.keresztnev || "") + ";;;",
      "FN:" + vEsc(fullName || "Névjegy")];
    if (d.ceg) L.push("ORG:" + vEsc(d.ceg));
    if (d.titulus) L.push("TITLE:" + vEsc(d.titulus));
    if (d.telefon) L.push("TEL;TYPE=CELL:" + d.telefon);
    if (d.email) L.push("EMAIL;TYPE=INTERNET:" + d.email);
    if (d.web) L.push("URL:" + d.web);
    (d.linkek || []).filter((l) => l && l.url).forEach((l) => L.push("URL:" + l.url));
    if (d.cim) L.push("ADR;TYPE=WORK:;;" + vEsc(d.cim) + ";;;;");
    if (d.bemutatkozas) L.push("NOTE:" + vEsc(d.bemutatkozas));
    const p = await photoBase64();
    if (p) L.push("PHOTO;ENCODING=b;TYPE=" + p.type + ":" + p.data);
    L.push("END:VCARD");
    return L.map(fold).join("\r\n") + "\r\n";
  }
  async function saveContact() {
    const vcf = await buildVCard();
    const file = (fullName || "nevjegy").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-") + ".vcf";
    const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
    const a = el("a", { href: URL.createObjectURL(blob), download: file });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    toast("Nyisd meg a letöltött névjegyet, és mentsd el");
  }

  /* ---------- QR-kód ---------- */
  function showQr() {
    const box = $("qr");
    if (!box.firstChild) {
      const qr = window.qrcode(0, "M");
      qr.addData(cardUrl);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
    }
    open("qrSheet");
  }

  /* ---------- Megosztás ---------- */
  async function share() {
    const data = { title: fullName, text: fullName + " névjegye", url: cardUrl };
    if (navigator.share) {
      try { await navigator.share(data); } catch (e) { /* bezárta a megosztást */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(cardUrl);
      toast("Link vágólapra másolva");
    } catch (e) {
      prompt("A névjegy linkje:", cardUrl);
    }
  }

  /* ---------- NFC-matrica ---------- */
  async function writeNfc() {
    if (!("NDEFReader" in window)) {
      info("NFC-matrica beállítása",
        "<p>Az NFC-matricát Androidon, Chrome böngészőből lehet felírni — ott ez a gomb közvetlenül megcsinálja.</p>" +
        "<p>iPhone-ról az ingyenes <b>NFC Tools</b> appal: <i>Írás → Rekord hozzáadása → URL</i>, és ezt a linket add meg:</p>" +
        '<p><b style="word-break:break-all">' + esc(cardUrl) + "</b></p>" +
        "<p>Kész matrica után bármelyik telefon (iPhone és Android is) a hozzáérintéskor megnyitja a névjegyet.</p>");
      return;
    }
    info("Érintsd hozzá a matricát", "<p>Tartsd az üres NFC-matricát vagy -kártyát a telefon hátuljához, amíg a „Kész” üzenet meg nem jelenik.</p>");
    try {
      const nfc = new window.NDEFReader();
      await nfc.write({ records: [{ recordType: "url", data: cardUrl }] }, { overwrite: true });
      close("infoSheet");
      toast("Kész! A matrica mostantól a névjegyedet nyitja meg");
    } catch (e) {
      close("infoSheet");
      toast(e && e.name === "NotAllowedError" ? "Az NFC-hozzáférés nincs engedélyezve" : "Nem sikerült — próbáld újra, és tartsd ott a matricát");
    }
  }

  /* ---------- Telepítés ---------- */
  let deferredPrompt = null;
  function setupInstall() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
    if (matchMedia("(display-mode: standalone)").matches || navigator.standalone === true) return;
    const btn = $("install");
    btn.hidden = false;
    addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; });
    btn.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        return;
      }
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const otherIos = ios && /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram/i.test(navigator.userAgent);
      const steps = ios
        ? ["Koppints a Megosztás gombra (négyzet, felfelé nyíllal) a Safari alján.", "Válaszd a Főképernyőhöz adás lehetőséget.", "Koppints a Hozzáadás gombra."]
        : ["Nyisd meg a böngésző menüjét (⋮ vagy ⋯).", "Válaszd a Telepítés vagy a Főképernyőhöz adás lehetőséget.", "Erősítsd meg a Telepítés gombbal."];
      if (otherIos) steps.unshift("Nyisd meg az oldalt Safariban — iPhone-on csak onnan lehet telepíteni.");
      info(ios ? "Telepítés iPhone-ra" : "Telepítés appként", "<ol>" + steps.map((s) => "<li>" + s + "</li>").join("") + "</ol>");
    });
  }

  /* ---------- Lapok, értesítés ---------- */
  let lastFocus = null;
  function open(id) {
    lastFocus = document.activeElement;
    $(id).hidden = false;
    $(id).querySelector("[data-close]").focus();
  }
  function close(id) {
    $(id).hidden = true;
    if (lastFocus) lastFocus.focus();
  }
  function info(title, html) {
    $("infoTitle").textContent = title;
    $("infoBody").innerHTML = html;
    open("infoSheet");
  }
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }

  document.querySelectorAll(".sheet").forEach((s) => {
    s.addEventListener("click", (e) => { if (e.target === s || e.target.closest("[data-close]")) close(s.id); });
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".sheet:not([hidden])").forEach((s) => close(s.id));
  });
  $("save").addEventListener("click", saveContact);
  $("showQr").addEventListener("click", showQr);
  $("share").addEventListener("click", share);
  $("nfc").addEventListener("click", writeNfc);

  render();
  setupInstall();
})();
