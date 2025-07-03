/* ---------- 共通 ---------- */
async function api(p, o = {}) {
  const r = await fetch(p, o);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
function showErr(m)  { document.getElementById("error" ).innerText = m; }
function toggleLoad(s){ document.getElementById("loading").classList.toggle("hidden", !s); }
function setResult(html) {
  const el = document.getElementById("result");
  el.innerHTML = html;
  el.classList.toggle("active", !!html.trim());
}

/* ---------- ルーティング ---------- */
const pages = ["home", "search", "list", "inventory"];
function showPage(id) {
  pages.forEach(p => document.getElementById(p).classList.toggle("hidden", p !== id));
  location.hash = "#" + id;
}
window.addEventListener("hashchange", () =>
  showPage(location.hash.slice(1) || "home")
);
showPage(location.hash.slice(1) || "home");

const drawer  = document.getElementById("drawer");
const overlay = document.getElementById("overlay");
const menuBtn = document.getElementById("menuBtn");
menuBtn.onclick = () => toggleDrawer(!drawer.classList.contains("open"));
overlay.onclick = () => toggleDrawer(false);
drawer.querySelectorAll("a").forEach(a => a.onclick = () => toggleDrawer(false));
function toggleDrawer(open) {
  drawer.classList.toggle("open", open);
  overlay.classList.toggle("hidden", !open);
}

/* ---------- 使い方ガイド ---------- */
const infoBtn=document.getElementById("infoBtn"),
      guideModal=document.getElementById("guideModal"),
      guideClose=document.getElementById("guideClose"),
      slides=[...document.querySelectorAll(".slide")],
      prevBtn=document.getElementById("prevSlide"),
      nextBtn=document.getElementById("nextSlide"),
      slideIndicator=document.getElementById("slideIndicator");
let curSlide=0;
function showSlide(i){
  slides.forEach((el,idx)=>el.classList.toggle("active",idx===i));
  slideIndicator.textContent=`${i+1} / ${slides.length}`;
  prevBtn.disabled=i===0; nextBtn.disabled=i===slides.length-1; curSlide=i;
}
infoBtn.onclick=()=>{guideModal.classList.remove("hidden");showSlide(0);};
guideClose.onclick=()=>guideModal.classList.add("hidden");
guideModal.onclick=e=>{if(e.target===guideModal)guideModal.classList.add("hidden");};
prevBtn.onclick=()=>{if(curSlide)showSlide(curSlide-1);};
nextBtn.onclick=()=>{if(curSlide<slides.length-1)showSlide(curSlide+1);};

/* ---------- 材料検索 ---------- */
const searchBtn=document.getElementById("searchButton"),
      addListBtn=document.getElementById("addListButton"),
      recipeInput=document.getElementById("recipeInput");
let lastResults=[];
searchBtn.onclick=async()=>{
  const text=recipeInput.value.trim();
  if(!text) return showErr("入力が空です");
  toggleLoad(true);showErr("");setResult("");addListBtn.classList.add("hidden");
  try{
    lastResults=await api("/parseRecipe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipe:text})});
    renderResults(lastResults);addListBtn.classList.remove("hidden");
  }catch(e){showErr(e.message);}finally{toggleLoad(false);}
};
function renderResults(arr){
  if(!arr.length) return setResult("<p>材料が見つかりません</p>");
  setResult(`<ul>${arr.map(i=>`<li>${i.name}: ${i.amount}</li>`).join("")}</ul>`);
}

/* ---------- 買い物リスト ---------- */
const listUL=document.getElementById("shoppingList"),
      clearBtn=document.getElementById("clearBought");
addListBtn.onclick=async()=>{
  try{
    await api("/api/ingredients/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:lastResults})});
    alert("追加 / 統合しました");
    if(location.hash==="#list") renderShopping();
    else location.hash="#list";
  }catch(e){alert(e.message);}
};

async function renderShopping(){
  const list   = await api("/api/ingredients");
  const fridge = await api("/api/fridge");
  listUL.innerHTML="";
  list.forEach(it=>{
    const fr=fridge.find(f=>f.name===it.name);
    const warn=fr?` (冷蔵庫に残り ${fr.amount})`:"";
    const cls=it.bought?"checked":"";
    const li=document.createElement("li");
    li.innerHTML=`<label class="${cls}">
        <input type="checkbox" data-id="${it.id}" ${it.bought?"checked":""}>
        ${it.name}: ${it.amount}${warn}
      </label>`;
    listUL.appendChild(li);
  });
}
listUL.onchange=async e=>{
  if(e.target.type==="checkbox"){
    await api("/api/ingredients/check",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(e.target.dataset.id),checked:e.target.checked})});
    renderShopping();
  }
};
clearBtn.onclick = () =>
  api("/api/ingredients/clearBought",{method:"DELETE"}).then(renderShopping);
window.addEventListener("hashchange",()=>{if(location.hash==="#list") renderShopping();});

/* ---------- 冷蔵庫 ---------- */
const invForm=document.getElementById("invForm"),
      invName=document.getElementById("invName"),
      invAmount=document.getElementById("invAmount"),
      invList=document.getElementById("invList");
async function renderInv(){
  const data=await api("/api/fridge");
  invList.innerHTML="";
  data.forEach(it=>{
    const li=document.createElement("li");
    li.innerHTML=`<span>${it.name}: ${it.amount}</span>
      <button data-id="${it.fridge_id}" class="del">&times;</button>`;
    invList.appendChild(li);
  });
}
invForm.onsubmit=async e=>{
  e.preventDefault();
  const name=invName.value.trim(), amount=invAmount.value.trim();
  if(!name||!amount){alert("食材名と量を入力してください");return;}
  try{
    await api("/api/fridge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,amount})});
    invForm.reset();renderInv();
  }catch(err){alert("追加に失敗:"+err.message);}
};
invList.onclick=async e=>{
  if(e.target.classList.contains("del")){
    await api(`/api/fridge/${e.target.dataset.id}`,{method:"DELETE"});
    renderInv();
  }
};
window.addEventListener("hashchange",()=>{if(location.hash==="#inventory") renderInv();});