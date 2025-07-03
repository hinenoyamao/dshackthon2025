/* =============================
   ルーティング & ドロワー
============================= */
const pages = ["home", "search", "list", "inventory"];

function showPage(id) {
  pages.forEach(p =>
    document.getElementById(p).classList.toggle("hidden", p !== id)
  );
  location.hash = "#" + id;
}
window.addEventListener("hashchange", () =>
  showPage(location.hash.slice(1) || "home")
);
showPage(location.hash.slice(1) || "home");

const drawer  = document.getElementById("drawer");
const overlay = document.getElementById("overlay");
const menuBtn = document.getElementById("menuBtn");
menuBtn.onclick   = () => toggleDrawer(!drawer.classList.contains("open"));
overlay.onclick   = () => toggleDrawer(false);
drawer.querySelectorAll("a").forEach(
  a => (a.onclick = () => toggleDrawer(false))
);
function toggleDrawer(open) {
  drawer.classList.toggle("open", open);
  overlay.classList.toggle("hidden", !open);
}

/* =============================
   使い方ガイド（モーダル）
============================= */
const infoBtn        = document.getElementById("infoBtn");
const guideModal     = document.getElementById("guideModal");
const guideClose     = document.getElementById("guideClose");
const slideEls       = [...document.querySelectorAll(".slide")];
const prevBtn        = document.getElementById("prevSlide");
const nextBtn        = document.getElementById("nextSlide");
const slideIndicator = document.getElementById("slideIndicator");
let current = 0;

function showSlide(i) {
  slideEls.forEach((el, idx) => el.classList.toggle("active", idx === i));
  slideIndicator.textContent = `${i + 1} / ${slideEls.length}`;
  prevBtn.disabled = i === 0;
  nextBtn.disabled = i === slideEls.length - 1;
}
infoBtn.onclick = () => {
  guideModal.classList.remove("hidden");
  current = 0;
  showSlide(current);
};
guideClose.onclick = () => guideModal.classList.add("hidden");
guideModal.onclick = e => {
  if (e.target === guideModal) guideModal.classList.add("hidden");
};
prevBtn.onclick = () => {
  if (current > 0) { current--; showSlide(current); }
};
nextBtn.onclick = () => {
  if (current < slideEls.length - 1) { current++; showSlide(current); }
};

/* =============================
   材料検索
============================= */
const searchBtn   = document.getElementById("searchButton");
const addListBtn  = document.getElementById("addListButton");
const recipeInput = document.getElementById("recipeInput");
let lastResults   = [];

searchBtn.onclick = () => {
  const text = recipeInput.value.trim();
  text ? queryLLM(text) : showErr("入力が空です");
};

async function queryLLM(text) {
  toggleLoad(true);
  showErr("");
  setResult("");
  addListBtn.classList.add("hidden");
  try {
    const res = await fetch("/parseRecipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe: text })
    });
    if (!res.ok) throw new Error("APIエラー");
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("食材を入力してください");
    lastResults = data;
    renderResults(data);
    addListBtn.classList.remove("hidden");
  } catch (e) {
    showErr(e.message);
  } finally {
    toggleLoad(false);
  }
}

function renderResults(items) {
  if (!items.length) {
    setResult("<p>材料が見つかりません</p>");
    return;
  }
  const listHtml = items
    .map(i => `<li>${i.name}: ${i.amount}</li>`)
    .join("");
  setResult(`<ul>${listHtml}</ul>`);
}

recipeInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    searchBtn.click();
  }
});

/* === ヘルパー: 数量と単位を分離 === */
function parseAmount(str = "") {
  const m = str.trim().match(/^([0-9]+(?:\\.[0-9]+)?)(.*)$/);
  if (!m) return { num: null, unit: str.trim() }; // 数字先頭でなければ数値なし
  return { num: parseFloat(m[1]), unit: m[2] };    // unit には元の余白も保持
}

/* === 重複食材を単位ごとに合算して追加 === */
addListBtn.onclick = () => {
  const list = load("shoppingList");

  lastResults.forEach(item => {
    const idx = list.findIndex(el => el.name === item.name);
    if (idx > -1) {
      // 既にある食材
      const cur = parseAmount(list[idx].amount);
      const add = parseAmount(item.amount);

      if (
        cur.num !== null &&
        add.num !== null &&
        cur.unit === add.unit       // 単位が一致
      ) {
        const total = cur.num + add.num;
        list[idx].amount = `${total}${cur.unit}`;
      } else {
        // 単位が異なる or 数値化不可 → 文字列で連結
        list[idx].amount = `${list[idx].amount} + ${item.amount}`;
      }
    } else {
      // 新規食材
      list.push({ ...item, bought: false });
    }
  });

  save("shoppingList", list);
  alert("追加 / 統合しました");
  addListBtn.classList.add("hidden");
  location.hash = "#list";
};

/* =============================
   買い物リスト
============================= */
const listUL   = document.getElementById("shoppingList");
const clearBtn = document.getElementById("clearBought");

function renderShopping() {
  listUL.innerHTML = "";
  load("shoppingList").forEach(item => {
    const li = document.createElement("li");
    const checked = item.bought ? "checked" : "";
    const cls = item.bought ? "checked" : "";
    li.innerHTML = `
      <label class="${cls}">
        <input type="checkbox" ${checked}> ${item.name}: ${item.amount}
      </label>
    `;
    listUL.appendChild(li);
  });
}
listUL.onchange = e => {
  if (e.target.type === "checkbox") {
    const idx  = [...listUL.querySelectorAll("input")].indexOf(e.target);
    const list = load("shoppingList");
    list[idx].bought = e.target.checked;
    save("shoppingList", list);
    renderShopping();
  }
};
clearBtn.onclick = () => {
  save("shoppingList", load("shoppingList").filter(i => !i.bought));
  renderShopping();
};
window.addEventListener("hashchange", () => {
  if (location.hash === "#list") renderShopping();
});

/* =============================
   在庫編集
============================= */
const invForm   = document.getElementById("invForm");
const invName   = document.getElementById("invName");
const invAmount = document.getElementById("invAmount");
const invList   = document.getElementById("invList");

function renderInv() {
  invList.innerHTML = "";
  load("inventory").forEach((item, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${item.name}: ${item.amount}</span>
      <button data-i="${idx}" class="del">&times;</button>
    `;
    invList.appendChild(li);
  });
}
invForm.onsubmit = e => {
  e.preventDefault();
  const list   = load("inventory");
  const name   = invName.value.trim();
  const amount = invAmount.value.trim();
  const idx    = list.findIndex(i => i.name === name);
  idx > -1 ? (list[idx].amount = amount)
           : list.push({ name, amount });
  save("inventory", list);
  invForm.reset();
  renderInv();
};
invList.onclick = e => {
  if (e.target.classList.contains("del")) {
    const list = load("inventory");
    list.splice(e.target.dataset.i, 1);
    save("inventory", list);
    renderInv();
  }
};
window.addEventListener("hashchange", () => {
  if (location.hash === "#inventory") renderInv();
});

/* =============================
   共通関数
============================= */
function toggleLoad(s) {
  document.getElementById("loading").classList.toggle("hidden", !s);
}
function showErr(m) {
  document.getElementById("error").innerText = m;
}
function setResult(html) {
  const el = document.getElementById("result");
  el.innerHTML = html;
  el.classList.toggle("active", !!html.trim());
}
function load(k) {
  return JSON.parse(localStorage.getItem(k) || "[]");
}
function save(k, v) {
  localStorage.setItem(k, JSON.stringify(v));
}