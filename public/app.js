/* =====================================================
   Recipe Helper – Frontend  (auth / DB / guide)
===================================================== */

/* ───────────────────────────────────
   1. 共通ヘルパー
────────────────────────────────── */
/* ユーザー向けメッセージ変換表 */
const ERROR_DICT = {
  "unauth"                 : "セッションが切れました。もう一度ログインしてください。",
  "invalid"               : "ユーザー名またはパスワードが違います。",
  "duplicate"              : "そのユーザー名は既に登録されています。",
  "name/pass required"   : "ユーザー名とパスワードを入力してください。",
  "recipe text empty"    : "料理名を入力してください。",
  "APIエラー"             : "サーバーとの通信に失敗しました。",
  "LLM API error"        : "材料取得に失敗しました。時間を空けて再試行してください。"
};
const toFriendly = (msg="") =>
  ERROR_DICT[msg.trim()] || msg.trim() || "エラーが発生しました。再度お試しください。";

async function api(p, o={}) {
  const r = await fetch(p, { credentials:"same-origin", ...o });
  if (!r.ok) {
    let code = `HTTP ${r.status}`;
    try { code = (await r.clone().json()).error || code; } catch {}
    throw new Error(code);          // ← err.message にコードを仕込む
  }
  return r.json();
}
const showErr   = m => (document.getElementById("error").innerText = m);
const toggleLoad= s => document.getElementById("loading").classList.toggle("hidden",!s);
function setResult(html){
  const el=document.getElementById("result");
  el.innerHTML=html; el.classList.toggle("active",!!html.trim());
}

/* ───────────────────────────────────
   2. ページ遷移 / Drawer
────────────────────────────────── */
const pages=["login","signup","home","search","list","inventory"];
if (!location.hash ||
    !["#login","#signup","#home","#search","#list","#inventory"].includes(location.hash)){
  location.hash = "#login";
}

// ① まず現在のハッシュを描画して“チラつき”を防ぐ
showPage(location.hash.slice(1) || "login");
function showPage(id){
  pages.forEach(p=>{
    const sec=document.getElementById(p);
    if(sec) sec.classList.toggle("hidden",p!==id);
  });
}
const drawer=document.getElementById("drawer"),
      overlay=document.getElementById("overlay"),
      menuBtn=document.getElementById("menuBtn");
menuBtn.onclick=()=>toggleDrawer(!drawer.classList.contains("open"));
overlay.onclick=()=>toggleDrawer(false);
drawer.querySelectorAll("a").forEach(a=>a.onclick=()=>toggleDrawer(false));
function toggleDrawer(o){drawer.classList.toggle("open",o);overlay.classList.toggle("hidden",!o);}

/* =====================================================
   3. 認証フロー
===================================================== */
const userLabel=document.getElementById("userLabel"),
      logoutBtn=document.getElementById("logoutBtn"),
      loginForm=document.getElementById("loginForm"),
      liName=document.getElementById("liName"),
      liPass=document.getElementById("liPass"),
      loginMsg=document.getElementById("loginMsg"),
      signupForm=document.getElementById("signupForm"),
      suName=document.getElementById("suName"),
      suPass=document.getElementById("suPass"),
      signupMsg=document.getElementById("signupMsg");

async function ensureAuth(){
  try{
    const {user}=await api("/auth/me");
    userLabel.textContent = user ? user.name : "ゲスト";
    if(!user && location.hash!=="#signup") location.hash="#login";
    if(user && (location.hash==="#login"||location.hash==="#signup")) location.hash="#home";
  }catch{
    location.hash="#login";
  }finally{
    showPage((location.hash||"#login").slice(1));
    switch (location.hash) {
      case "#inventory":
        renderInv();
        break;
      case "#list":
        renderShopping();
        break;
    }
    }
    if(location.hash==="#login"){ loginForm.reset(); loginMsg.textContent=""; }
  }

ensureAuth();
window.addEventListener("hashchange", ensureAuth);

/* サインアップ */
signupForm.onsubmit=async e=>{
  e.preventDefault();
  try{
    await api("/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name:suName.value.trim(),password:suPass.value})});
    signupMsg.textContent="登録完了！ログインしてください";
    signupForm.reset(); location.hash="#login";
  }catch(err){signupMsg.textContent=ERROR_DICT[err.message];}
};

/* ログイン */
loginForm.onsubmit=async e=>{
  e.preventDefault();
  try{
    const r=await api("/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name:liName.value.trim(),password:liPass.value})});
    userLabel.textContent=r.name;
    loginMsg.textContent=""; location.hash="#home";
  }catch(err){loginMsg.textContent=ERROR_DICT[err.message];}
};

/* ログアウト */
logoutBtn.onclick=()=>api("/auth/logout",{method:"POST"}).then(()=>location.hash="#login");

/* =====================================================
   4. 使い方ガイド（モーダル）
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
  prevBtn.disabled=!i; nextBtn.disabled=i===slides.length-1; curSlide=i;
}
infoBtn.onclick=()=>{guideModal.classList.remove("hidden");showSlide(0);};
guideClose.onclick=()=>guideModal.classList.add("hidden");
guideModal.onclick=e=>{if(e.target===guideModal)guideModal.classList.add("hidden");};
prevBtn.onclick=()=>{if(curSlide)showSlide(curSlide-1);};
nextBtn.onclick=()=>{if(curSlide<slides.length-1)showSlide(curSlide+1);};

/* =====================================================
   5. 材料検索
===================================================== */
const searchBtn=document.getElementById("searchButton"),
      addListBtn=document.getElementById("addListButton"),
      recipeInput=document.getElementById("recipeInput");
let lastResults=[];
recipeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();      // 改行やsubmitを防ぐ
    searchBtn.click();       // ボタンのクリックを呼び出す
  }
});
searchBtn.onclick=async()=>{
  const text=recipeInput.value.trim();
  if(!text) return showErr("料理名を入力してください");
  toggleLoad(true);showErr("");setResult("");addListBtn.classList.add("hidden");
  try{
    lastResults=await api("/parseRecipe",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({recipe:text})});
    if(!lastResults.length){ setResult("<p>材料が見つかりません</p>"); return; }
    setResult(`<ul>${lastResults.map(i=>`<li>${i.name}: ${i.amount}</li>`).join("")}</ul>`);
    addListBtn.classList.remove("hidden");
  }catch(err){showErr(ERROR_DICT[err.message]);}
  finally{toggleLoad(false);}
};

/* =====================================================
   6. 買い物リスト
===================================================== */
const listUL=document.getElementById("shoppingList"),
      clearBtn=document.getElementById("clearBought");
addListBtn.onclick=async()=>{
  try{
    await Promise.all(lastResults.map(item=>
      api("/api/ingredients/add",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:item.name,amount:item.amount})})
    ));
    alert("リストに追加しました");
    location.hash==="#list" ? renderShopping() : location.hash="#list";
  }catch(err){showErr(ERROR_DICT[err.message]);}
};

async function renderShopping(){
  try{
    const list=await api("/api/ingredients");
    const fr  =await api("/api/fridge");
    listUL.innerHTML="";
    list.forEach(it=>{
      const f=fr.find(x=>x.name===it.name);
      const warn=f?` (冷蔵庫に残り ${f.amount})`:"";
      listUL.insertAdjacentHTML("beforeend",
        `<li><label class="${it.bought?"checked":""}">
          <input type="checkbox" data-id="${it.id}" ${it.bought?"checked":""}>
          ${it.name}: ${it.amount}${warn}
        </label></li>`);
    });
  }catch(err){showErr(ERROR_DICT[err.message]);}
}
listUL.onchange=async e=>{
  if(e.target.type==="checkbox"){
    try{
      await api("/api/ingredients/check",{method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:+e.target.dataset.id,checked:e.target.checked})});
      renderShopping();
    }catch(err){showErr(err.message);}
  }
};
clearBtn.onclick=()=>api("/api/ingredients/clearBought",{method:"DELETE"})
  .then(renderShopping).catch(err=>showErr(ERROR_DICT[err.message]));
window.addEventListener("hashchange",()=>{if(location.hash==="#list")renderShopping();});

/* =====================================================
   7. 冷蔵庫リスト
===================================================== */
const invForm=document.getElementById("invForm"),
      invName=document.getElementById("invName"),
      invAmount=document.getElementById("invAmount"),
      invList=document.getElementById("invList");
async function renderInv(){
  try{
    const data=await api("/api/fridge");
    invList.innerHTML="";
    data.forEach(it=>{
      invList.insertAdjacentHTML("beforeend",
        `<li><span>${it.name}: ${it.amount}</span>
         <button class="del" data-id="${it.id}">&times;</button></li>`);
    });
  }catch(err){showErr(ERROR_DICT[err.message]);}
}
invForm.onsubmit=async e=>{
  e.preventDefault();
  const name=invName.value.trim(), amount=invAmount.value.trim();
  if(!name||!amount) return showErr("食材名と量を入力してください");
  try{
    await api("/api/fridge",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name,amount})});
    invForm.reset(); renderInv();
  }catch(err){showErr(ERROR_DICT[err.message]);}
};
invList.onclick=async e=>{
  if(e.target.classList.contains("del")){
    try{
      await api(`/api/fridge/${e.target.dataset.id}`,{method:"DELETE"});
      renderInv();
    }catch(err){showErr(ERROR_DICT[err.message]);}
  }
};
window.addEventListener("hashchange",()=>{if(location.hash==="#inventory")renderInv();});