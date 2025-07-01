/* ===== ルーティング & ドロワー ===== */
const pages=["home","search","list","inventory"];
function showPage(id){
  pages.forEach(p=>document.getElementById(p).classList.toggle("hidden",p!==id));
  location.hash="#"+id;
}
window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)||"home"));
showPage(location.hash.slice(1)||"home");

const drawer   = document.getElementById("drawer");
const overlay  = document.getElementById("overlay");
document.getElementById("menuBtn").onclick = ()=>toggleDrawer(true);
overlay.onclick = ()=>toggleDrawer(false);
drawer.querySelectorAll("a").forEach(a=>a.onclick=()=>toggleDrawer(false));
function toggleDrawer(open){ drawer.classList.toggle("open",open); overlay.classList.toggle("hidden",!open); }

/* ===== 材料検索 ===== */
const searchBtn=document.getElementById("searchButton");
const addListBtn=document.getElementById("addListButton");
const recipeInput=document.getElementById("recipeInput");
let lastResults=[];
searchBtn.onclick=()=>{ const t=recipeInput.value.trim(); t?queryLLM(t):showErr("入力が空です"); };
async function queryLLM(text){
  toggleLoad(true);showErr("");setResult("");addListBtn.classList.add("hidden");
  try{
    const res=await fetch("/parseRecipe",{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify({recipe:text})});
    if(!res.ok)throw new Error("APIエラー");const data=await res.json();
    if(!Array.isArray(data))throw new Error("形式不正");lastResults=data;renderResults(data);addListBtn.classList.remove("hidden");
  }catch(e){showErr(e.message);}finally{toggleLoad(false);}
}
function renderResults(items){
  if(!items.length){setResult("<p>材料が見つかりません</p>");return;}
  setResult("<ul>"+items.map(i=>`<li>${i.name}: ${i.amount}</li>`).join("")+"</ul>");
}
addListBtn.onclick=()=>{const list=load("shoppingList");lastResults.forEach(i=>list.push({...i,bought:false}));save("shoppingList",list);alert("追加しました");addListBtn.classList.add("hidden");};

/* ===== 買い物リスト ===== */
const listUL=document.getElementById("shoppingList");
const clearBtn=document.getElementById("clearBought");
function renderShopping(){ listUL.innerHTML="";load("shoppingList").forEach((i,idx)=>{const li=document.createElement("li");li.innerHTML=`<label class="${i.bought?'checked':''}"><input type="checkbox" ${i.bought?'checked':''}> ${i.name}: ${i.amount}</label><button data-i="${idx}" class="del">&times;</button>`;listUL.append(li);});}
listUL.onchange=e=>{if(e.target.type==="checkbox"){const idx=[...listUL.querySelectorAll("input")].indexOf(e.target);const l=load("shoppingList");l[idx].bought=e.target.checked;save("shoppingList",l);renderShopping();}};
listUL.onclick=e=>{if(e.target.classList.contains("del")){const l=load("shoppingList");l.splice(e.target.dataset.i,1);save("shoppingList",l);renderShopping();}};
clearBtn.onclick=()=>{save("shoppingList",load("shoppingList").filter(i=>!i.bought));renderShopping();};
window.addEventListener("hashchange",()=>{if(location.hash==="#list")renderShopping();});

/* ===== 在庫編集 ===== */
const invForm=document.getElementById("invForm");
const invName=document.getElementById("invName");
const invAmount=document.getElementById("invAmount");
const invList=document.getElementById("invList");
function renderInv(){invList.innerHTML="";load("inventory").forEach((i,idx)=>{const li=document.createElement("li");li.innerHTML=`<span>${i.name}: ${i.amount}</span><button data-i="${idx}" class="del">&times;</button>`;invList.append(li);});}
invForm.onsubmit=e=>{e.preventDefault();const l=load("inventory");const idx=l.findIndex(i=>i.name===invName.value.trim());if(idx>-1)l[idx].amount=invAmount.value.trim();else l.push({name:invName.value.trim(),amount:invAmount.value.trim()});save("inventory",l);invForm.reset();renderInv();};
invList.onclick=e=>{if(e.target.classList.contains("del")){const l=load("inventory");l.splice(e.target.dataset.i,1);save("inventory",l);renderInv();}};
window.addEventListener("hashchange",()=>{if(location.hash==="#inventory")renderInv();});

/* ===== 共通 ===== */
function toggleLoad(b){document.getElementById("loading").classList.toggle("hidden",!b);}
function showErr(m){document.getElementById("error").innerText=m;}
function setResult(h){document.getElementById("result").innerHTML=h;}
function load(k){return JSON.parse(localStorage.getItem(k)||"[]");}
function save(k,v){localStorage.setItem(k,JSON.stringify(v));}