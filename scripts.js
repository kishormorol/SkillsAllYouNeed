const $  = (sel,root=document) => root.querySelector(sel);
const $$ = (sel,root=document) => Array.from(root.querySelectorAll(sel));

/* ───── Smooth scroll with ease-in-out ───── */
function smoothScrollTo(el, offset = 0) {
  const start = window.scrollY;
  const end = el.getBoundingClientRect().top + start + offset;
  const duration = 400;
  const startTime = performance.now();
  function step(now) {
    const elapsed = (now - startTime) / duration;
    const t = Math.min(elapsed, 1);
    const ease = t < .5 ? 2*t*t : -1+(4-2*t)*t; // easeInOutQuad
    window.scrollTo(0, start + (end - start) * ease);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ───── Build chips ───── */
function buildChips(){
  const ecoBox = $("#eco-chips"); ecoBox.innerHTML = "";
  ECOSYSTEMS.forEach(e=>{
    const cnt = SKILLS.filter(x=>x.ecosystem===e).length;
    const b = document.createElement("button");
    b.className = "chip"; b.setAttribute("aria-pressed","false");
    b.dataset.eco = e; b.dataset.filterVal = e;
    b.innerHTML = `<span class="glyph-wrap">${uniqueSvg(GLYPHS[e])}<span>${e}</span></span><span class="badge">${cnt}</span>`;
    b.addEventListener("click", ()=>toggle(state.ecosystems,e,b));
    ecoBox.appendChild(b);
  });

  const catBox = $("#cat-chips"); catBox.innerHTML = "";
  CATEGORIES.forEach(c=>{
    const cnt = SKILLS.filter(x=>x.category===c).length;
    const b = document.createElement("button");
    b.className = "chip"; b.setAttribute("aria-pressed","false");
    b.dataset.filterVal = c;
    b.innerHTML = `${c}<span class="badge">${cnt}</span>`;
    b.addEventListener("click", ()=>toggle(state.categories,c,b));
    catBox.appendChild(b);
  });

  const stBox = $("#status-chips"); stBox.innerHTML = "";
  STATUSES.forEach(s=>{
    const cnt = SKILLS.filter(x=>x.status===s).length;
    const b = document.createElement("button");
    b.className = "chip"; b.setAttribute("aria-pressed","false");
    b.dataset.filterVal = s;
    b.innerHTML = `${s}<span class="badge">${cnt}</span>`;
    b.addEventListener("click", ()=>toggle(state.statuses,s,b));
    stBox.appendChild(b);
  });
}

function toggle(set, value, el){
  if(set.has(value)){ set.delete(value); el.setAttribute("aria-pressed","false"); }
  else{ set.add(value); el.setAttribute("aria-pressed","true"); }
  render();
}

/* ───── Grid render with asymmetric spans ───── */
const SPAN_PATTERN = [4, 4, 4,  6, 6,  4, 4, 4,  8, 4,  4, 4, 4,  6, 6];
function spanFor(i){ return SPAN_PATTERN[i % SPAN_PATTERN.length]; }

function matchesFilters(s){
  if(state.favOnly && !favorites.has(s.id)) return false;
  if(state.newOnly && !NEW_IDS.has(s.id)) return false;
  if(state.ecosystems.size && !state.ecosystems.has(s.ecosystem)) return false;
  if(state.categories.size && !state.categories.has(s.category)) return false;
  if(state.statuses.size && !state.statuses.has(s.status)) return false;
  if(state.query){
    const q = state.query.toLowerCase();
    const blob = (s.name+" "+s.description+" "+s.trigger+" "+s.example+" "+s.category+" "+s.ecosystem+" "+(s.howto||HOWTO[s.id]||"")).toLowerCase();
    if(!blob.includes(q)) return false;
  }
  return true;
}

function render(){
  const grid = $("#grid");
  grid.innerHTML = "";
  let filtered = SKILLS.filter(matchesFilters);

  // sort
  if(state.sort === "recent"){
    const rank = s => (s.status === "Beta" ? 0 : (s.status === "Stable" ? 1 : 2));
    filtered = filtered.slice().sort((a,b)=> rank(a) - rank(b));
  }

  lastFiltered = filtered;
  focusedCardIdx = -1;

  $("#count").textContent = filtered.length;
  const totalEl = $("#total-count"); if(totalEl) totalEl.textContent = SKILLS.length;
  /* Only update the hero counter after the first load — boot uses animateCount() instead */
  const heroCount = $("#hero-skill-count");
  if(heroCount && render._firstDone) heroCount.textContent = SKILLS.length;

  renderActiveFilters();

  if(filtered.length === 0){
    const qLabel = state.query ? `"${escapeHTML(state.query)}"` : "that combination";
    grid.innerHTML = `<div class="no-results">Nothing matched ${qLabel}.<small>Try broader terms · or fewer filters</small><button class="nr-reset" onclick="document.getElementById('reset').click()">Reset all filters ↺</button></div>`;
    return;
  }

  filtered.forEach((s, i)=>{
    const span = spanFor(i);
    const featured = (span >= 8) || (i === 0);
    const isSaved = favorites.has(s.id);
    const card = document.createElement("article");
    card.className = `card ${span===6?"span-6":""} ${span===8?"span-8":""} ${span===12?"span-12":""} ${featured?"featured":""}`;
    card.tabIndex = 0;
    card.setAttribute("role","button");
    card.setAttribute("aria-label", `${s.name} — ${s.ecosystem} — open details`);
    card.id = `skill-${s.id}`;
    card.dataset.id  = s.id;
    card.dataset.eco = s.ecosystem;
    card.dataset.trigger = s.trigger;
    card.dataset.example = s.example;
    card.dataset.source  = s.source;

    const nameHTML = s.name.replace(/(\S+)$/, '<span class="it">$1</span>');
    const isNew = NEW_IDS.has(s.id);

    card.innerHTML = `
      <div class="top">
        <div class="glyph">${uniqueSvg(GLYPHS[s.ecosystem])}</div>
        <div class="id-wrap">
          <div class="id">${s.id}${s._custom?'<span class="custom-badge">custom</span>':''}${isNew?'<span class="new-badge">new</span>':''}</div>
          <button class="anchor" title="Copy deep link" aria-label="Copy deep link to ${s.name}" data-copy="${s.id}">¶</button>
        </div>
        <div class="meta-top" style="flex:1">
          <span class="eco-label">${s.ecosystem}</span>
          <span>№ ${String(SKILLS.indexOf(s)+1).padStart(3,'0')} / ${String(SKILLS.length).padStart(3,'0')}</span>
        </div>
      </div>
      <h3 class="name">${nameHTML}</h3>
      <p class="desc">${codeBacktick(escapeHTML(s.description))}</p>
      <p class="trigger" title="Click to copy trigger phrase">${codeBacktick(escapeHTML(s.trigger))}<span class="copy-hint" aria-hidden="true">⎘ copy</span></p>
      <div class="bottom">
        <span class="cat" data-cat="${s.category}">${s.category}</span>
        <span class="status" data-status="${s.status}"><span class="status-dot"></span>${s.status}</span>
        <button class="fav-btn${isSaved?" saved":""}" data-fav-id="${s.id}"
          title="${isSaved?"Remove from saved":"Save this skill"}"
          aria-label="${isSaved?"Remove from saved":"Save"}">${isSaved?"♥":"♡"}</button>
      </div>
    `;
    card.addEventListener("click", (e)=>{
      if(e.target.closest(".anchor") || e.target.closest(".fav-btn")) return;
      openSheet(s);
    });
    card.addEventListener("keydown", e=>{
      if((e.key==="Enter"||e.key===" ") && !e.target.classList.contains("anchor") && !e.target.classList.contains("fav-btn")){
        e.preventDefault(); openSheet(s);
      }
    });
    card.querySelector(".anchor").addEventListener("click", (e)=>{
      e.stopPropagation(); copyDeepLink(s.id);
    });
    card.querySelector(".fav-btn").addEventListener("click", (e)=>{
      e.stopPropagation();
      const was = favorites.has(s.id);
      was ? favorites.delete(s.id) : favorites.add(s.id);
      saveFavs(); updateFavCount();
      const btn = e.currentTarget;
      btn.classList.toggle("saved", !was);
      btn.textContent = !was ? "♥" : "♡";
      btn.title = !was ? "Remove from saved" : "Save this skill";
      if(state.favOnly) render();
    });
    card.querySelector(".trigger").addEventListener("click", (e)=>{
      e.stopPropagation();
      navigator.clipboard && navigator.clipboard.writeText(s.trigger).catch(()=>{});
      showToast("trigger copied");
    });
    grid.appendChild(card);
  });

  // staggered fade-in — fast stagger on filter, gentle on first load
  requestAnimationFrame(()=>{
    const step = render._firstDone ? 8 : 18;
    $$("#grid .card").forEach((c,i)=>{
      setTimeout(()=>c.classList.add("in"), i*step);
    });
    render._firstDone = true;
  });
}

/* ───── Sheet ───── */
function openSheet(s, opts){
  opts = opts || {};
  const sheet = $("#sheet");
  const nameHTML = s.name.replace(/(\S+)$/, '<span class="it">$1</span>');
  currentSheetIdx = lastFiltered.findIndex(x => x.id === s.id);
  const hasPrev = currentSheetIdx > 0;
  const hasNext = currentSheetIdx < lastFiltered.length - 1;
  const isSaved = favorites.has(s.id);

  sheet.innerHTML = `
    <button class="close" aria-label="Close" id="closeBtn">Close ✕</button>
    <div class="sheet-top">
      <div class="glyph-lg">${uniqueSvg(GLYPHS[s.ecosystem])}</div>
      <div class="top-meta" style="flex:1">
        <div><b>${s.ecosystem}</b> &nbsp;·&nbsp; ${s.category} &nbsp;·&nbsp; ${s.status}</div>
        <div>id: ${s.id} &nbsp;·&nbsp; entry № ${String(SKILLS.indexOf(s)+1).padStart(3,'0')} of ${SKILLS.length} &nbsp;·&nbsp; <a href="#${s.id}" id="sheetCopy" style="color:var(--accent);border-bottom:1px solid var(--accent)">copy deep link</a></div>
      </div>
    </div>
    <h3 id="sheet-title">${nameHTML}</h3>
    <p class="lede">${codeBacktick(escapeHTML(s.description))}</p>

    <h4>Trigger</h4>
    <pre class="field">${splitTriggers(codeBacktick(escapeHTML(s.trigger)))}</pre>

    <h4>How to use</h4>
    <p class="field serif">${codeBacktick(escapeHTML(s.howto || HOWTO[s.id] || "See the source link below for setup instructions."))}</p>

    <h4>Worked example</h4>
    <p class="field serif">${codeBacktick(escapeHTML(s.example))}</p>

    <h4>Source &amp; citation</h4>
    <a class="src" href="${escapeHTML(s.source)}" target="_blank" rel="noopener">${escapeHTML(s.source)}</a>

    <div class="sheet-actions">
      <button id="favSheetBtn" class="${isSaved?"is-saved":""}" aria-label="${isSaved?"Remove from saved":"Save this skill"}">${isSaved?"♥ Saved":"♡ Save"}</button>
      <button id="shareBtn" aria-label="Share this skill">Share →</button>
      <button id="copyTriggerBtn" aria-label="Copy trigger phrase">Copy trigger</button>
    </div>

    ${(()=>{
      const related = SKILLS.filter(r =>
        r.id !== s.id && (
          r.category === s.category ||
          (r.ecosystem === s.ecosystem && r.id !== s.id)
        )
      ).slice(0,4);
      if(!related.length) return "";
      return `<h4>Related skills</h4>
      <div class="related-list">${
        related.map(r => `<button class="related-chip" data-related-id="${r.id}">${r.name}</button>`).join("")
      }</div>`;
    })()}

    <div class="sheet-nav">
      <button id="prevSkill"${!hasPrev?" disabled":""} aria-label="Previous skill">← prev</button>
      <span class="nav-pos">${currentSheetIdx+1} of ${lastFiltered.length}</span>
      <button id="nextSkill"${!hasNext?" disabled":""} aria-label="Next skill">next →</button>
    </div>
  `;

  $("#scrim").classList.add("open");
  document.body.style.overflow = "hidden";
  sheet.scrollTop = 0;

  $("#closeBtn").addEventListener("click", closeSheet);
  $("#sheetCopy").addEventListener("click", (e)=>{ e.preventDefault(); copyDeepLink(s.id); });

  if(hasPrev) $("#prevSkill").addEventListener("click", ()=>openSheet(lastFiltered[currentSheetIdx-1]));
  if(hasNext) $("#nextSkill").addEventListener("click", ()=>openSheet(lastFiltered[currentSheetIdx+1]));

  $("#favSheetBtn").addEventListener("click", ()=>{
    const was = favorites.has(s.id);
    was ? favorites.delete(s.id) : favorites.add(s.id);
    saveFavs(); updateFavCount();
    const fb = $("#favSheetBtn");
    fb.className = favorites.has(s.id) ? "is-saved" : "";
    fb.textContent = favorites.has(s.id) ? "♥ Saved" : "♡ Save";
    fb.setAttribute("aria-label", favorites.has(s.id) ? "Remove from saved" : "Save this skill");
    const cardFav = document.querySelector(`[data-fav-id="${s.id}"]`);
    if(cardFav){ cardFav.classList.toggle("saved", favorites.has(s.id)); cardFav.textContent = favorites.has(s.id)?"♥":"♡"; }
    if(state.favOnly) render();
  });

  $("#shareBtn").addEventListener("click", ()=>{
    const url = location.origin + location.pathname + location.search + "#" + s.id;
    if(navigator.share){ navigator.share({title:`${s.name} — SkillsAllYouNeed`, url}).catch(()=>copyDeepLink(s.id)); }
    else { copyDeepLink(s.id); }
  });

  $("#copyTriggerBtn").addEventListener("click", ()=>{
    navigator.clipboard && navigator.clipboard.writeText(s.trigger).catch(()=>{});
    showToast("trigger copied");
  });

  $$(".related-chip", sheet).forEach(btn => {
    btn.addEventListener("click", ()=>{
      const target = SKILLS.find(x=>x.id === btn.dataset.relatedId);
      if(target) openSheet(target);
    });
  });

  if(s._custom){
    const delBtn = document.createElement("button");
    delBtn.className = "is-delete"; delBtn.textContent = "Delete ✕";
    delBtn.setAttribute("aria-label","Delete this custom skill");
    delBtn.addEventListener("click", ()=>{
      if(!confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
      const idx = SKILLS.findIndex(x=>x.id===s.id);
      if(idx > -1) SKILLS.splice(idx, 1);
      const remaining = JSON.parse(localStorage.getItem("skills-custom")||"[]").filter(x=>x.id!==s.id);
      localStorage.setItem("skills-custom", JSON.stringify(remaining));
      closeSheet(); render();
      showToast(`"${s.name}" deleted`);
    });
    sheet.querySelector(".sheet-actions").appendChild(delBtn);
  }

  if(opts.pushHash !== false && location.hash !== "#"+s.id){
    history.replaceState(null, "", "#"+s.id);
  }
}
function closeSheet(){
  $("#scrim").classList.remove("open");
  document.body.style.overflow = "";
  if(location.hash){ history.replaceState(null, "", location.pathname + location.search); }
}
$("#scrim").addEventListener("click", e=>{ if(e.target.id === "scrim") closeSheet(); });

/* ───── Deep link / toast ───── */
function copyDeepLink(id){
  const url = location.origin + location.pathname + location.search + "#" + id;
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = url; ta.style.position="fixed"; ta.style.left="-9999px";
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand("copy"); }catch(_){}
    document.body.removeChild(ta);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).catch(fallback);
  } else { fallback(); }
  showToast("link copied · ¶ " + id);
}
let toastTimer;
function showToast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove("show"), 1800);
}

/* ───── Ecosystem deep-dive strip ───── */
function buildEcoStrip(){
  const wrap = $("#eco-strip");
  wrap.innerHTML = "";
  ECOSYSTEMS.forEach(eco => {
    const count = SKILLS.filter(s => s.ecosystem === eco).length;
    const cell = document.createElement("button");
    cell.className = "eco-cell";
    cell.dataset.eco = eco;
    cell.setAttribute("aria-label", `Filter to ${eco} — ${count} entries`);
    cell.innerHTML = `
      <div class="eco-head">
        <div class="eco-glyph">${uniqueSvg(GLYPHS[eco])}</div>
        <div class="eco-tag"><b>${String(count).padStart(2,'0')}</b>entries</div>
      </div>
      <h4 class="eco-name">${eco.replace(/(\w+)$/, '<span class="it">$1</span>')}</h4>
      <p class="eco-blurb">${ECO_BLURB[eco]}</p>
      <div class="eco-link">→ Jump to ${eco} entries</div>
    `;
    cell.addEventListener("click", ()=>{
      // single-select this ecosystem
      state.ecosystems.clear();
      state.ecosystems.add(eco);
      $$("#eco-chips .chip").forEach(c=>{
        c.setAttribute("aria-pressed", c.dataset.eco === eco ? "true" : "false");
      });
      render();
      smoothScrollTo($("#grid"), -20);
    });
    wrap.appendChild(cell);
  });
}

/* ───── Shortcuts modal ───── */
function openShortcuts(){ $("#shortcuts").classList.add("open"); }
function closeShortcuts(){ $("#shortcuts").classList.remove("open"); }
$("#hint-key").addEventListener("click", ()=>{
  const s = $("#shortcuts");
  s.classList.toggle("open");
});
$("#closeFn").addEventListener("click", closeShortcuts);

/* ───── Global keyboard shortcuts (unified) ───── */
document.addEventListener("keydown", (e)=>{
  const tag = (e.target && e.target.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "textarea" || e.target.isContentEditable;
  const sheetOpen = $("#scrim").classList.contains("open");

  // Escape closes whatever is open
  if(e.key === "Escape"){
    if(sheetOpen) { closeSheet(); return; }
    if(document.getElementById("add-scrim").classList.contains("open")){ closeAddSheet(); return; }
    if($("#shortcuts").classList.contains("open")){ closeShortcuts(); return; }
    return;
  }

  // Arrow navigation inside open sheet
  if(sheetOpen){
    if(e.key === "ArrowLeft" && currentSheetIdx > 0){
      e.preventDefault(); openSheet(lastFiltered[currentSheetIdx-1]); return;
    }
    if(e.key === "ArrowRight" && currentSheetIdx < lastFiltered.length-1){
      e.preventDefault(); openSheet(lastFiltered[currentSheetIdx+1]); return;
    }
  }

  if(typing) return;

  if(e.key === "/"){
    e.preventDefault(); $("#q").focus(); $("#q").select();
  } else if(e.key === "?" || (e.shiftKey && e.key === "/")){
    e.preventDefault(); $("#shortcuts").classList.toggle("open");
  } else if((e.key === "j" || e.key === "k") && !sheetOpen){
    e.preventDefault();
    const cards = $$("#grid .card");
    if(!cards.length) return;
    focusedCardIdx = e.key==="j"
      ? Math.min(focusedCardIdx+1, cards.length-1)
      : Math.max(focusedCardIdx-1, 0);
    cards[focusedCardIdx].focus();
    cards[focusedCardIdx].scrollIntoView({block:"nearest", behavior:"smooth"});
  } else if(e.key === "f"){
    if(sheetOpen){
      const fb = $("#favSheetBtn"); if(fb) fb.click();
    } else {
      const focused = document.activeElement;
      if(focused && focused.classList.contains("card")){
        const btn = focused.querySelector(".fav-btn"); if(btn) btn.click();
      }
    }
  } else if(e.key === "r" && !sheetOpen){
    if(lastFiltered.length) openSheet(lastFiltered[Math.floor(Math.random()*lastFiltered.length)]);
  }
});

/* ───── Sort toggle ───── */
function setSort(mode){
  state.sort = mode;
  $("#sort-index").classList.toggle("on", mode === "index");
  $("#sort-recent").classList.toggle("on", mode === "recent");
  render();
}
$("#sort-index").addEventListener("click", ()=>setSort("index"));
$("#sort-recent").addEventListener("click", ()=>setSort("recent"));
["sort-index","sort-recent"].forEach(id=>{
  $("#"+id).addEventListener("keydown", e=>{
    if(e.key === "Enter" || e.key === " "){ e.preventDefault(); setSort(id==="sort-index"?"index":"recent"); }
  });
});

/* ───── Active filters bar ───── */
function renderActiveFilters(){
  const bar = $("#active-filters"); if(!bar) return;
  const tags = [];
  state.ecosystems.forEach(e => tags.push({type:"eco",  val:e}));
  state.categories.forEach(c => tags.push({type:"cat",  val:c}));
  state.statuses.forEach(s   => tags.push({type:"stat", val:s}));
  if(state.favOnly) tags.push({type:"fav",    val:"Saved only"});
  if(state.newOnly) tags.push({type:"newOnly", val:"New additions"});
  if(state.query)   tags.push({type:"q",       val:`"${state.query}"`});

  if(!tags.length){ bar.style.display="none"; return; }
  bar.style.display = "flex";
  bar.innerHTML = `<span class="af-label">Active:</span>` + tags.map(t=>
    `<button class="active-filter-tag" data-type="${t.type}" data-val="${escapeHTML(t.val)}">${escapeHTML(t.val)} ×</button>`
  ).join("");

  $$(".active-filter-tag", bar).forEach(tag => {
    tag.addEventListener("click", ()=>{
      const {type, val} = tag.dataset;
      if(type==="eco"){
        state.ecosystems.delete(val);
        $$(`#eco-chips .chip`).forEach(c=>{ if(c.dataset.filterVal===val) c.setAttribute("aria-pressed","false"); });
      } else if(type==="cat"){
        state.categories.delete(val);
        $$(`#cat-chips .chip`).forEach(c=>{ if(c.dataset.filterVal===val) c.setAttribute("aria-pressed","false"); });
      } else if(type==="stat"){
        state.statuses.delete(val);
        $$(`#status-chips .chip`).forEach(c=>{ if(c.dataset.filterVal===val) c.setAttribute("aria-pressed","false"); });
      } else if(type==="fav"){
        state.favOnly = false;
        $("#fav-filter-btn")?.setAttribute("aria-pressed","false");
      } else if(type==="newOnly"){
        state.newOnly = false;
        $$(".preset-btn").forEach(b=>{ if(b.dataset.preset==="new") b.classList.remove("active"); });
      } else if(type==="q"){
        state.query = ""; $("#q").value = "";
      }
      render();
    });
  });
}

/* ───── Scroll-to-top ───── */
window.addEventListener("scroll", ()=>{
  const btn = $("#scroll-top");
  if(btn) btn.classList.toggle("visible", window.scrollY > 500);
}, {passive:true});
$("#scroll-top").addEventListener("click", ()=>window.scrollTo({top:0, behavior:"smooth"}));

/* ───── Grid toolbar ───── */
$("#surprise-btn").addEventListener("click", ()=>{
  if(!lastFiltered.length) return;
  openSheet(lastFiltered[Math.floor(Math.random()*lastFiltered.length)]);
});

$("#fav-filter-btn").addEventListener("click", ()=>{
  state.favOnly = !state.favOnly;
  $("#fav-filter-btn").setAttribute("aria-pressed", state.favOnly?"true":"false");
  render();
});

$("#export-btn").addEventListener("click", ()=>{
  const data = lastFiltered.map(({id,name,ecosystem,category,status,description,trigger,howto,example,source})=>
    ({id,name,ecosystem,category,status,description,trigger,howto,example,source}));
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const url  = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {href:url, download:`skills-${Date.now()}.json`});
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`exported ${data.length} entr${data.length===1?"y":"ies"}`);
});

/* ───── Hash routing ───── */
function openFromHash(){
  const id = location.hash.replace("#","");
  if(!id) return;
  const s = SKILLS.find(x => x.id === id);
  if(s){
    openSheet(s, {pushHash:false});
    const card = document.getElementById("skill-"+id);
    if(card){ card.classList.add("hashed"); setTimeout(()=>card.classList.remove("hashed"), 2400); }
  }
}
window.addEventListener("hashchange", openFromHash);

/* ───── Matrix ───── */
function buildMatrix(){
  const t = $("#matrix");
  const headRow = `
    <thead>
      <tr>
        <th>Capability</th>
        ${ECOSYSTEMS.map(e=>`<th><div class="head-glyph">${uniqueSvg(GLYPHS[e])}<span>${e}</span></div></th>`).join("")}
      </tr>
    </thead>`;
  const body = `
    <tbody>
      ${MATRIX_ROWS.map((row, i)=>{
        const [label, ...cells] = row;
        return `<tr>
          <td><span class="row-num">${String(i+1).padStart(2,'0')}</span>${label}</td>
          ${cells.map(c=>{
            if(c==="y") return `<td><span class="mark yes">✓</span></td>`;
            if(c==="n") return `<td><span class="mark no">✗</span></td>`;
            return `<td><span class="mark partial">partial</span></td>`;
          }).join("")}
        </tr>`;
      }).join("")}
    </tbody>`;
  t.insertAdjacentHTML("beforeend", headRow);
  t.insertAdjacentHTML("beforeend", body);
}

/* ───── References ───── */
function buildRefs(){
  const ol = $("#refs-list");
  ol.innerHTML = REFS.map(r=>{
    const isUrl = r.venue && !r.venue.includes(' ');
    const venueHTML = isUrl
      ? `<a href="https://${r.venue}" target="_blank" rel="noopener">${r.venue}</a>`
      : r.venue;
    return `<li>${r.who}. <em>${r.title}</em>. ${r.year}.<span class="where">${venueHTML}</span></li>`;
  }).join("");
}

/* ───── Wire search ───── */
$("#q").addEventListener("input", e=>{ state.query = e.target.value.trim(); render(); });
$("#reset").addEventListener("click", ()=>{
  state.query = "";
  state.ecosystems.clear(); state.categories.clear(); state.statuses.clear();
  state.favOnly = false; state.newOnly = false;
  $("#q").value = "";
  $$(".chip[aria-pressed='true']").forEach(c=>c.setAttribute("aria-pressed","false"));
  $$(".preset-btn").forEach(b=>b.classList.remove("active"));
  render();
});

/* ───── Add Skill modal ───── */
const ECO_PREFIX = {
  "Claude":"cl","Claude Code":"cc","ChatGPT":"gpt","Gemini":"gm",
  "Perplexity":"pp","Microsoft 365 Copilot":"mc",  "Antigravity":"ag","GitHub Copilot":"ghc","OpenCode":"oc","Codex":"cx"
};
function genId(eco, name){
  const prefix = ECO_PREFIX[eco] || "xx";
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  return prefix + "-" + slug;
}
function openAddSheet(){
  document.getElementById("add-scrim").classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(()=>document.getElementById("f-name").focus(), 60);
}
function closeAddSheet(){
  document.getElementById("add-scrim").classList.remove("open");
  document.body.style.overflow = "";
  document.getElementById("add-skill-form").reset();
  document.getElementById("id-preview").innerHTML = "id: <b>—</b>";
}
document.getElementById("add-skill-btn").addEventListener("click", openAddSheet);
document.getElementById("add-close-btn").addEventListener("click", closeAddSheet);
document.getElementById("add-cancel-btn").addEventListener("click", closeAddSheet);
document.getElementById("add-scrim").addEventListener("click", e=>{ if(e.target.id==="add-scrim") closeAddSheet(); });

// Live ID preview as user types name / picks ecosystem
["f-name","f-ecosystem"].forEach(fid=>{
  document.getElementById(fid).addEventListener("input", ()=>{
    const name = document.getElementById("f-name").value;
    const eco  = document.getElementById("f-ecosystem").value;
    const el   = document.getElementById("id-preview");
    el.innerHTML = (name && eco) ? `id: <b>${genId(eco,name)}</b>` : "id: <b>—</b>";
  });
});

document.getElementById("add-skill-form").addEventListener("submit", e=>{
  e.preventDefault();
  const val = id => document.getElementById(id).value.trim();
  const name        = val("f-name");
  const ecosystem   = val("f-ecosystem");
  const category    = val("f-category");
  const status      = val("f-status");
  const description = val("f-desc");
  const trigger     = val("f-trigger");
  const howto       = val("f-howto");
  const example     = val("f-example");
  const source      = val("f-source") || "#";

  if(!name||!ecosystem||!category||!status||!description||!trigger||!howto||!example){
    showToast("please fill in all required fields");
    return;
  }
  const id = genId(ecosystem, name);
  if(SKILLS.find(x=>x.id===id)){
    showToast("a skill with that name already exists");
    return;
  }
  const skill = {id,name,ecosystem,category,status,description,trigger,howto,example,source,_custom:true};
  SKILLS.push(skill);
  const saved = JSON.parse(localStorage.getItem("skills-custom")||"[]");
  saved.push(skill);
  localStorage.setItem("skills-custom", JSON.stringify(saved));
  closeAddSheet();
  render();
  showToast(`"${name}" added`);
  requestAnimationFrame(()=>openSheet(skill));
});

/* ───── Boot ───── */
buildChips();
buildEcoStrip();
render();
openFromHash();
updateFavCount();

/* Wire corpus download link in footer */
const _corpusLink = document.getElementById("export-corpus-link");
if(_corpusLink) _corpusLink.addEventListener("click", (e)=>{ e.preventDefault(); $("#export-btn").click(); });

/* ═══════════════════════════════════════════════════════════
   DARK MODE TOGGLE
═══════════════════════════════════════════════════════════ */
(function(){
  const btn = document.getElementById("dark-toggle");
  if(!btn) return;
  function applyIcon(){
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    btn.textContent = dark ? "○" : "●";
    btn.title = dark ? "Switch to light mode" : "Switch to dark mode";
    btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  applyIcon();
  btn.addEventListener("click", ()=>{
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
    localStorage.setItem("sayn-theme", isDark ? "light" : "dark");
    applyIcon();
  });
})();

/* ═══════════════════════════════════════════════════════════
   ANIMATED HERO COUNTERS
═══════════════════════════════════════════════════════════ */
function animateCount(el, target, duration){
  if(!el) return;
  duration = duration || 1100;
  const startTime = performance.now();
  function tick(now){
    const t = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); /* ease-out cubic */
    el.textContent = Math.round(eased * target);
    if(t < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}
/* Run after boot (boot is synchronous above, so this fires right after) */
setTimeout(()=>{
  animateCount(document.getElementById("hero-skill-count"), SKILLS.length, 1100);
}, 80);

/* ═══════════════════════════════════════════════════════════
   GITHUB STAR COUNT — always fetches live on every page load
   so the count reflects new stars immediately.
   GitHub allows 60 unauthenticated req/hr per IP — fine for
   a static site where each visitor has their own quota.
═══════════════════════════════════════════════════════════ */
(function(){
  const REPO = "kishormorol/SkillsAllYouNeed";

  function fmtStars(n){
    if(n >= 1000) return (n/1000).toFixed(1).replace(/\.0$/,"") + "k";
    return String(n);
  }

  function applyCount(n){
    const navCount = document.getElementById("star-count");
    const ctaCount = document.getElementById("star-count-cta");
    if(n < 1){ return; } /* keep hidden until at least 1 star */
    const formatted = fmtStars(n);
    if(navCount){ navCount.textContent = formatted; navCount.style.display = ""; }
    if(ctaCount){ ctaCount.textContent = formatted; ctaCount.classList.add("loaded"); }
  }

  fetch("https://api.github.com/repos/" + REPO, {cache:"no-store"})
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => applyCount(data.stargazers_count || 0))
    .catch(() => {}); /* fail silently — button still works */
})();

/* ═══════════════════════════════════════════════════════════
   QUICK PRESET FILTERS
═══════════════════════════════════════════════════════════ */
(function(){
  function resetAll(){
    state.ecosystems.clear(); state.categories.clear();
    state.statuses.clear(); state.query = ""; state.favOnly = false; state.newOnly = false;
    document.getElementById("q").value = "";
    document.querySelectorAll(".chip[aria-pressed='true']").forEach(c=>c.setAttribute("aria-pressed","false"));
    document.querySelectorAll(".preset-btn").forEach(b=>b.classList.remove("active"));
  }
  document.querySelectorAll(".preset-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const p = btn.dataset.preset;
      resetAll();

      if(p === "claude-code"){
        state.ecosystems.add("Claude Code");
        document.querySelector(`#eco-chips .chip[data-eco="Claude Code"]`)?.setAttribute("aria-pressed","true");
        btn.classList.add("active");
      } else if(p === "agentic"){
        state.categories.add("Agentic");
        document.querySelector(`#cat-chips .chip[data-filter-val="Agentic"]`)?.setAttribute("aria-pressed","true");
        btn.classList.add("active");
      } else if(p === "stable"){
        state.statuses.add("Stable");
        document.querySelector(`#status-chips .chip[data-filter-val="Stable"]`)?.setAttribute("aria-pressed","true");
        btn.classList.add("active");
      } else if(p === "new"){
        state.newOnly = true;
        btn.classList.add("active");
      }
      /* "clear" just resets — already done above */
      render();
      smoothScrollTo(document.getElementById("catalog-section"), -20);
    });
  });

  /* Deactivate preset buttons when user manually changes filters */
  document.getElementById("q").addEventListener("input", ()=>{
    document.querySelectorAll(".preset-btn").forEach(b=>b.classList.remove("active"));
  });
  document.querySelectorAll(".chip").forEach(c=>{
    c.addEventListener("click", ()=>{
      document.querySelectorAll(".preset-btn").forEach(b=>b.classList.remove("active"));
    });
  });
})();

/* ═══════════════════════════════════════════════════════════
   ROTATING SEARCH PLACEHOLDER
═══════════════════════════════════════════════════════════ */
(function(){
  const hints = [
    "search names, descriptions, triggers…",
    "try: memory",
    "try: code review",
    "try: generate image",
    "try: webhook",
    "try: artifacts",
    "try: voice mode",
    "try: Claude Code",
    "try: export to docx",
    "try: browser automation",
  ];
  let idx = 0;
  const q = document.getElementById("q");
  setInterval(()=>{
    if(document.activeElement !== q && !state.query){
      idx = (idx + 1) % hints.length;
      q.setAttribute("placeholder", hints[idx]);
    }
  }, 3200);
})();

/* ═══════════════════════════════════════════════════════════
   ONBOARDING STRIP — show once, dismiss to localStorage
═══════════════════════════════════════════════════════════ */
(function(){
  const strip = document.getElementById("onboarding-strip");
  if(!strip) return;
  if(!localStorage.getItem("sayn-onboarding-seen")){
    strip.style.display = "block";
  }
  document.getElementById("onboarding-dismiss").addEventListener("click", ()=>{
    strip.style.display = "none";
    localStorage.setItem("sayn-onboarding-seen", "1");
  });
})();

/* ───── Smooth-scroll all internal anchor links ───── */
document.querySelectorAll('a[href^="#"]').forEach(link=>{
  link.addEventListener("click", (e)=>{
    const id = link.getAttribute("href").slice(1);
    const target = document.getElementById(id);
    if(target){ e.preventDefault(); target.scrollIntoView({behavior:"smooth", block:"start"}); }
  });
});

/* ───── Chip: reset all on double-click of already-active chip ───── */
// (chips already toggle on single click; this just adds polish)


/* ───── Make add-skill-btn also reachable via keyboard Enter/Space ───── */
document.getElementById("add-skill-btn").addEventListener("keydown", e=>{
  if(e.key === "Enter" || e.key === " "){ e.preventDefault(); openAddSheet(); }
});
document.getElementById("surprise-btn").addEventListener("keydown", e=>{
  if(e.key === "Enter" || e.key === " "){
    e.preventDefault();
    if(lastFiltered.length) openSheet(lastFiltered[Math.floor(Math.random()*lastFiltered.length)]);
  }
});
