/* =====================================================
   Recipe Helper – Frontend  (auth / DB / guide)
===================================================== */

/* ───────────────────────────────────
   1. 共通ヘルパー
────────────────────────────────── */
async function api(p, o = {}) {
  o.credentials = "same-origin";                // ★ クッキーを必ず送信
  const r = await fetch(p, o);
  if (!r.ok) {
    if (r.status === 401) { location.hash = "#login"; throw new Error("unauth"); }
    throw new Error(await r.text());
  }
  return r.json();
}
function showErr(m){document.getElementById("error").innerText=m;}
function toggleLoad(s){document.getElementById("loading").classList.toggle("hidden",!s);}
function setResult(html){
  const el=document.getElementById("result");
  el.innerHTML=html;
  el.classList.toggle("active",!!html.trim());
}

/* ───────────────────────────────────
   2. ページ遷移 / Drawer
────────────────────────────────── */
const pages=["login","signup","home","search","list","inventory"];
function showPage(id){pages.forEach(p=>document.getElementById(p).classList.toggle("hidden",p!==id));location.hash="#"+id;}
window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)||"home"));
showPage(location.hash.slice(1)||"home");

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

/* 認証状態を取得して画面遷移 */
async function ensureAuth(){
  try{
    const {user}=await api("/auth/me");
    userLabel.textContent=user?user.name:"ゲスト";
    if(!user && location.hash!=="#signup"){location.hash="#login";}
    if(user && (location.hash==="#login"||location.hash==="#signup")) location.hash="#home";
  }catch{/* 通信失敗時は無視 */}
}
ensureAuth();
window.addEventListener("hashchange",ensureAuth);

/* サインアップ */
signupForm.onsubmit=async e=>{
  e.preventDefault();
  try{
    await api("/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:suName.value.trim(),password:suPass.value})});
    signupMsg.textContent="登録完了！ログインしてください";
    signupForm.reset(); location.hash="#login";
  }catch(err){signupMsg.textContent=err.message;}
};

/* ログイン */
loginForm.onsubmit=async e=>{
  e.preventDefault();
  try{
    const r=await api("/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:liName.value.trim(),password:liPass.value})});
    userLabel.textContent=r.name;
    loginMsg.textContent="";
    location.hash="#home";
  }catch(err){loginMsg.textContent=err.message;}
};

/* ログアウト */
logoutBtn.onclick=()=>api("/auth/logout",{method:"POST"}).then(()=>{location.hash="#login";});

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
   6. 買い物リスト
===================================================== */
const listUL=document.getElementById("shoppingList"),
      clearBtn=document.getElementById("clearBought");
addListBtn.onclick = async () => {
  try {
    // 1件ずつ個別にAPIへPOST
    for (const item of lastResults) {
      await api("/api/ingredients/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name, amount: item.amount })
      });
    }
    alert("追加 / 統合しました");
    location.hash === "#list" ? renderShopping() : location.hash = "#list";
  } catch (err) {
    alert(err.message);
  }
};
      

async function renderShopping(){
  const list=await api("/api/ingredients");
  const fr  =await api("/api/fridge");
  listUL.innerHTML="";
  list.forEach(it=>{
    const f=fr.find(x=>x.name===it.name);
    const warn=f?` (冷蔵庫に残り ${f.amount})`:"";
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
    await api("/api/ingredients/check",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:+e.target.dataset.id,checked:e.target.checked})});
    renderShopping();
  }
};
clearBtn.onclick=()=>api("/api/ingredients/clearBought",{method:"DELETE"}).then(renderShopping);
window.addEventListener("hashchange",()=>{if(location.hash==="#list")renderShopping();});

/* =====================================================
   7. 冷蔵庫リスト
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
  }catch(err){alert(err.message);}
};
invList.onclick=async e=>{
  if(e.target.classList.contains("del")){
    await api(`/api/fridge/${e.target.dataset.id}`,{method:"DELETE"});
    renderInv();
  }
};
window.addEventListener("hashchange",()=>{if(location.hash==="#inventory")renderInv();});