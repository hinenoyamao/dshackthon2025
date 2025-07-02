/* =============================
   ルーティング & ドロワー
   ============================= */
const pages = ["home", "search", "list", "inventory"];

function showPage(id) {
  pages.forEach(page => {
    document.getElementById(page).classList.toggle("hidden", page !== id);
  });
  location.hash = "#" + id;
}

window.addEventListener("hashchange", () => {
  showPage(location.hash.slice(1) || "home");
});

showPage(location.hash.slice(1) || "home");

const drawer = document.getElementById("drawer");
const overlay = document.getElementById("overlay");
const menuBtn = document.getElementById("menuBtn");

menuBtn.onclick = () => {
  const willOpen = !drawer.classList.contains("open");
  toggleDrawer(willOpen);
};

overlay.onclick = () => toggleDrawer(false);
drawer.querySelectorAll("a").forEach(a => {
  a.onclick = () => toggleDrawer(false);
});

function toggleDrawer(open) {
  drawer.classList.toggle("open", open);
  overlay.classList.toggle("hidden", !open);
}

/* =============================
   材料検索
   ============================= */
const searchBtn = document.getElementById("searchButton");
const addListBtn = document.getElementById("addListButton");
const recipeInput = document.getElementById("recipeInput");
let lastResults = [];

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
  const listHtml = items.map(i => `<li>${i.name}: ${i.amount}</li>`).join("");
  setResult(`<ul>${listHtml}</ul>`);
}

addListBtn.onclick = () => {
  const list = load("shoppingList");
  lastResults.forEach(i => list.push({ ...i, bought: false }));
  save("shoppingList", list);
  alert("追加しました");
  addListBtn.classList.add("hidden");
   location.hash = "#list";
};

/* =============================
   買い物リスト
   ============================= */
const listUL = document.getElementById("shoppingList");
const clearBtn = document.getElementById("clearBought");

function renderShopping() {
  listUL.innerHTML = "";
  load("shoppingList").forEach((item, idx) => {
    const li = document.createElement("li");
    const checked = item.bought ? "checked" : "";
    const labelClass = item.bought ? "checked" : "";
    li.innerHTML = `
      <label class="${labelClass}">
        <input type="checkbox" ${checked}> ${item.name}: ${item.amount}
      </label>
    
    `;
    listUL.appendChild(li);
  });
}

listUL.onchange = (e) => {
  if (e.target.type === "checkbox") {
    const checkboxes = [...listUL.querySelectorAll("input")];
    const idx = checkboxes.indexOf(e.target);
    const list = load("shoppingList");
    list[idx].bought = e.target.checked;
    save("shoppingList", list);
    renderShopping();
  }
};

listUL.onclick = (e) => {
  if (e.target.classList.contains("del")) {
    const list = load("shoppingList");
    list.splice(e.target.dataset.i, 1);
    save("shoppingList", list);
    renderShopping();
  }
};

clearBtn.onclick = () => {
  const filtered = load("shoppingList").filter(item => !item.bought);
  save("shoppingList", filtered);
  renderShopping();
};

window.addEventListener("hashchange", () => {
  if (location.hash === "#list") {
    renderShopping();
  }
});

/* =============================
   在庫編集
   ============================= */
const invForm = document.getElementById("invForm");
const invName = document.getElementById("invName");
const invAmount = document.getElementById("invAmount");
const invList = document.getElementById("invList");

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

invForm.onsubmit = (e) => {
  e.preventDefault();
  const list = load("inventory");
  const name = invName.value.trim();
  const amount = invAmount.value.trim();
  const idx = list.findIndex(item => item.name === name);

  if (idx > -1) {
    list[idx].amount = amount;
  } else {
    list.push({ name, amount });
  }

  save("inventory", list);
  invForm.reset();
  renderInv();
};

invList.onclick = (e) => {
  if (e.target.classList.contains("del")) {
    const list = load("inventory");
    list.splice(e.target.dataset.i, 1);
    save("inventory", list);
    renderInv();
  }
};

window.addEventListener("hashchange", () => {
  if (location.hash === "#inventory") {
    renderInv();
  }
});

/* =============================
   共通関数
   ============================= */
function toggleLoad(show) {
  document.getElementById("loading").classList.toggle("hidden", !show);
}

function showErr(message) {
  document.getElementById("error").innerText = message;
}

function setResult(html) {
  const resultEl = document.getElementById("result");
  resultEl.innerHTML = html;

  if (html && html.trim() !== "") {
    resultEl.classList.add("active");
  } else {
    resultEl.classList.remove("active");
  }
}

function load(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}