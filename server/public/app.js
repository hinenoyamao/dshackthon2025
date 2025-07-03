/* =====================================================
   Recipe Helper  Frontend  – 2025-07-04  (Auth 統合版)
   - login / signup / logout（Cookie ベース）
   - 既存機能：材料検索＋買い物リスト(DB)＋冷蔵庫(DB)＋ガイド
===================================================== */

/* ---------- 共通 ---------- */
async function api(p, o = {}) {
  const r = await fetch(p, o);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
function showErr(m)  { document.getElementById("error" ).innerText = m; }
function toggleLoad(s){ document.getElementById("loading").classList.toggle("hidden", !s); }
function setResult(html){
  const el=document.getElementById("result");
  el.innerHTML=html;
  el.classList.toggle("active",!!html.trim());
}

/* ---------- Cookie Helper ---------- */
function setCookie(n,v,d=7){
  const t=new Date();t.setTime(t.getTime()+d*24*60*60*1000);
  document.cookie=`${n}=${encodeURIComponent(v)};path=/;expires=${t.toUTCString()}`;
}
function getCookie(n){
  const m=document.cookie.match(new RegExp(`${n}=([^;]+)`));
  return m?decodeURIComponent(m[1]):null;
}
function delCookie(n){
  document.cookie=`${n}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/* ---------- ページ遷移 ---------- */
const pages=["login","signup","home","search","list","inventory"];
function showPage(id){
  pages.forEach(p=>document.getElementById(p).classList.toggle("hidden",p!==id));
  location.hash="#"+id;
}
window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)||"home"));
showPage(location.hash.slice(1)||"home");

/* ---------- Drawer ---------- */
const drawer=document.getElementById("drawer"),
      overlay=document.getElementById("overlay"),
      menuBtn=document.getElementById("menuBtn");
menuBtn.onclick=()=>toggleDrawer(!drawer.classList.contains("open"));
overlay.onclick=()=>toggleDrawer(false);
drawer.querySelectorAll("a").forEach(a=>a.onclick=()=>toggleDrawer(false));
function toggleDrawer(o){
  drawer.classList.toggle("open",o);
  overlay.classList.toggle("hidden",!o);
}

/* =====================================================
   １. 認証まわり
===================================================== */
const userLabel = document.getElementById("userLabel");
const logoutBtn = document.getElementById("logoutBtn");
const loginForm = document.getElementById("loginForm"),
      liName    = document.getElementById("liName"),
      liPass    = document.getElementById("liPass"),
      loginMsg  = document.getElementById("loginMsg");
const signupForm= document.getElementById("signupForm"),
      suName    = document.getElementById("suName"),
      suPass    = document.getElementById("suPass"),
      signupMsg = document.getElementById("signupMsg");

/* --- ユーザーストア（Cookie に JSON 保持） --- */
function loadUsers(){try{return JSON.parse(getCookie("users")||"{}");}catch{return {}}}
function saveUsers(obj){setCookie("users",JSON.stringify(obj));}

/* --- 認証チェック＆リダイレクト --- */
function ensureAuth(){
  const u=getCookie("loginUser");
  userLabel.textContent = u ? u : "ゲスト";
  if(!u && location.hash!=="#signup"){location.hash="#login";}
  if(u && (location.hash==="#login"||location.hash==="#signup")){location.hash="#home";}
}
window.addEventListener("hashchange",ensureAuth);
ensureAuth();     // 初期実行

/* --- サインアップ処理 --- */
signupForm.onsubmit=e=>{
  e.preventDefault();
  const users=loadUsers();
  const u=suName.value.trim(), p=suPass.value;
  if(users[u]){signupMsg.textContent="既存ユーザーです";return;}
  users[u]=p; saveUsers(users);
  signupMsg.textContent="登録完了！ログインしてください";
  signupForm.reset();
  location.hash="#login";
};

/* --- ログイン処理 --- */
loginForm.onsubmit=e=>{
  e.preventDefault();
  const users=loadUsers();
  const u=liName.value.trim(), p=liPass.value;
  if(users[u]&&users[u]===p){
    setCookie("loginUser",u);
    loginMsg.textContent="";
    ensureAuth();
    location.hash="#home";
  }else{
    loginMsg.textContent="ユーザー名かパスワードが違います";
  }
};

/* --- ログアウト --- */
logoutBtn.onclick=()=>{
  delCookie("loginUser");
  ensureAuth();
  location.hash="#login";
};

/* =====================================================
   ２. 使い方ガイド（モーダル）
===================================================== */
const infoBtn=document.getElementById("infoBtn"),
      guideModal=document.getElementById("guideModal"),
      guideClose=document.getElementById("guideClose"),
      slides=[...document.querySelectorAll(".slide")],
      prevBtn=document.getElementById("prevSlide"),
      nextBtn=document.getElementById("nextSlide"),
      slideIndicator=document.getElementById("slideIndicator");
let curSlide=0;
function showSlide(i){
  slides.forEach((el,j)=>el.classList.toggle("active",j===i));
  slideIndicator.textContent=`${i+1} / ${slides.length}`;
  prevBtn.disabled=!i;
  nextBtn.disabled=i===slides.length-1;
  curSlide=i;
}
infoBtn.onclick=()=>{guideModal.classList.remove("hidden");showSlide(0);};
guideClose.onclick=()=>guideModal.classList.add("hidden");
guideModal.onclick=e=>{if(e.target===guideModal)guideModal.classList.add("hidden");};
prevBtn.onclick=()=>{if(curSlide)showSlide(curSlide-1);};
nextBtn.onclick=()=>{if(curSlide<slides.length-1)showSlide(curSlide+1);};

/* =====================================================
   ３. 材料検索
===================================================== */
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
  if(!arr.length)return setResult("<p>材料が見つかりません</p>");
  setResult(`<ul>${arr.map(i=>`<li>${i.name}: ${i.amount}</li>`).join("")}</ul>`);
}

/* =====================================================
   ４. 買い物リスト（ingredients テーブル）
===================================================== */
const listUL=document.getElementById("shoppingList"),
      clearBtn=document.getElementById("clearBought");
addListBtn.onclick=async()=>{
  try{
    await api("/api/ingredients/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:lastResults})});
    alert("追加 / 統合しました");
    location.hash==="#list"?renderShopping():location.hash="#list";
  }catch(e){alert(e.message);}
};

async function renderShopping(){
  const list=await api("/api/ingredients");
  const fr  =await api("/api/fridge");
  listUL.innerHTML="";
  list.forEach(it=>{
    const warn=(fr.find(x=>x.name===it.name))?` (冷蔵庫に残り ${fr.find(x=>x.name===it.name).amount})`:"";
    const li=document.createElement("li");
    li.innerHTML=`<label class="${it.bought?"checked":""}">
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
clearBtn.onclick=()=>api("/api/ingredients/clearBought",{method:"DELETE"}).then(renderShopping);
window.addEventListener("hashchange",()=>{if(location.hash==="#list")renderShopping();});

/* =====================================================
   ５. 冷蔵庫（fridge テーブル）
===================================================== */
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
window.addEventListener("hashchange",()=>{if(location.hash==="#inventory")renderInv();});