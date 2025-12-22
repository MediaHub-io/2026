const CONFIG={TVMAZE_API:'https://api.tvmaze.com/shows',JIKAN_API:'https://api.jikan.moe/v4/top/anime',UNLOCK_COST:25,REGISTRATION_BONUS:300,DAILY_BONUS:10,CACHE_DURATION:300000};
let currentUser=null;
let unlockedContent=new Set();
let favoriteContent=new Set();
let lastBonusDate=null;
let currentModalContent=null;
const elements={
authScreen:document.getElementById('authScreen'),
authForm:document.getElementById('authForm'),
userNameInput:document.getElementById('userName'),
mainHeader:document.getElementById('mainHeader'),
userAvatar:document.getElementById('userAvatar'),
userDisplayName:document.getElementById('userDisplayName'),
userCoins:document.getElementById('userCoins'),
coinsAmount:document.getElementById('coinsAmount'),
logoutBtn:document.getElementById('logoutBtn'),
heroSection:document.getElementById('heroSection'),
dailyBonusBtn:document.getElementById('dailyBonus'),
mainContent:document.getElementById('mainContent'),
seriesSection:document.getElementById('seriesSection'),
animeSection:document.getElementById('animeSection'),
favoritesSection:document.getElementById('favoritesSection'),
seriesGrid:document.getElementById('seriesGrid'),
animeGrid:document.getElementById('animeGrid'),
favoritesGrid:document.getElementById('favoritesGrid'),
tabBtns:document.querySelectorAll('.tab-btn'),
contentModal:document.getElementById('contentModal'),
modalTitle:document.getElementById('modalTitle'),
modalPoster:document.getElementById('modalPoster'),
modalDescription:document.getElementById('modalDescription'),
modalWatchBtn:document.getElementById('modalWatchBtn'),
modalUnlockBtn:document.getElementById('modalUnlockBtn'),
modalFavoriteBtn:document.getElementById('modalFavoriteBtn'),
closeModal:document.getElementById('closeModal'),
loadingOverlay:document.getElementById('loadingOverlay'),
notificationContainer:document.getElementById('notificationContainer')
};
const stateManager={
saveUserData(){
if(!currentUser)return;
localStorage.setItem('mediahub_data',JSON.stringify({
user:currentUser,
unlocked:Array.from(unlockedContent),
favorites:Array.from(favoriteContent),
lastBonus:lastBonusDate
}));
},
loadUserData(){
const saved=localStorage.getItem('mediahub_data');
if(!saved)return false;
const data=JSON.parse(saved);
currentUser=data.user;
unlockedContent=new Set(data.unlocked||[]);
favoriteContent=new Set(data.favorites||[]);
lastBonusDate=data.lastBonus||null;
return true;
},
updateCoinsDisplay(){
if(!currentUser)return;
elements.coinsAmount.textContent=currentUser.coins;
elements.userCoins.textContent=`${currentUser.coins} monedas`;
}
};
const ui={
showNotification(msg,type='info'){
const n=document.createElement('div');
n.className=`notification ${type}`;
n.textContent=msg;
elements.notificationContainer.appendChild(n);
setTimeout(()=>n.remove(),3000);
},
showPlatform(){
elements.authScreen.classList.add('hidden');
elements.mainHeader.classList.remove('hidden');
elements.heroSection.classList.remove('hidden');
elements.mainContent.classList.remove('hidden');
elements.userAvatar.textContent=currentUser.name.charAt(0).toUpperCase();
elements.userDisplayName.textContent=currentUser.name;
stateManager.updateCoinsDisplay();
this.loadInitialContent();
},
showSection(id){
[elements.seriesSection,elements.animeSection,elements.favoritesSection].forEach(s=>s.classList.add('hidden'));
document.getElementById(`${id}Section`).classList.remove('hidden');
elements.tabBtns.forEach(b=>{
b.classList.toggle('active',b.dataset.section===id);
});
if(id==='favorites')this.displayFavorites();
},
async loadInitialContent(){
elements.loadingOverlay.classList.remove('hidden');
try{
await Promise.all([contentManager.fetchTVShows(),contentManager.fetchAnime()]);
}finally{
elements.loadingOverlay.classList.add('hidden');
}
},
displayFavorites(){
elements.favoritesGrid.innerHTML=favoriteContent.size===0?'<p>No hay favoritos</p>':'<p>Tienes '+favoriteContent.size+' favoritos</p>';
},
showModal(item,type){
currentModalContent={item,type};
const id=item.id||item.mal_id;
const isUnlocked=unlockedContent.has(`${type}_${id}`);
elements.modalTitle.textContent=isUnlocked?(item.name||item.title):'Contenido Bloqueado';
elements.modalPoster.src=item.image?.original||item.images?.jpg?.large_image_url;
elements.modalDescription.textContent=isUnlocked?(item.summary?.replace(/<[^>]*>/g,'')||item.synopsis||'Sin descripción.'):'Desbloquea para ver los detalles.';
elements.modalWatchBtn.classList.toggle('hidden',!isUnlocked);
elements.modalUnlockBtn.classList.toggle('hidden',isUnlocked);
elements.modalFavoriteBtn.textContent=favoriteContent.has(`${type}_${id}`)?'Quitar Favorito':'Añadir Favorito';
elements.contentModal.classList.remove('hidden');
}
};
const contentManager={
async fetchTVShows(){
const r=await fetch(CONFIG.TVMAZE_API);
const data=await r.json();
this.displayContent(data.slice(0,20),elements.seriesGrid,'series');
},
async fetchAnime(){
const r=await fetch(CONFIG.JIKAN_API);
const data=await r.json();
this.displayContent(data.data.slice(0,20),elements.animeGrid,'anime');
},
displayContent(items,grid,type){
grid.innerHTML='';
items.forEach(item=>{
const id=item.id||item.mal_id;
const title=item.name||item.title;
const isUnlocked=unlockedContent.has(`${type}_${id}`);
const div=document.createElement('div');
div.className='content-card';
div.innerHTML=`
<img src="${item.image?.medium||item.images?.jpg?.image_url}" alt="${title}">
<h3>${isUnlocked?title:'Bloqueado'}</h3>
<button onclick="handleContentClick('${type}',${JSON.stringify(item).replace(/"/g,'&quot;')})">${isUnlocked?'Ver':'Detalles'}</button>
`;
grid.appendChild(div);
});
}
};
function handleContentClick(type,item){
ui.showModal(item,type);
}
function unlockContent(){
if(!currentModalContent)return;
const {item,type}=currentModalContent;
const id=item.id||item.mal_id;
if(currentUser.coins>=CONFIG.UNLOCK_COST){
currentUser.coins-=CONFIG.UNLOCK_COST;
unlockedContent.add(`${type}_${id}`);
stateManager.updateCoinsDisplay();
stateManager.saveUserData();
ui.showNotification('Desbloqueado con éxito','success');
ui.showModal(item,type);
ui.loadInitialContent();
}else{
ui.showNotification('Monedas insuficientes','error');
}
}
function toggleFavorite(){
if(!currentModalContent)return;
const {item,type}=currentModalContent;
const id=item.id||item.mal_id;
const key=`${type}_${id}`;
if(favoriteContent.has(key))favoriteContent.delete(key);
else favoriteContent.add(key);
stateManager.saveUserData();
ui.showModal(item,type);
}
function claimDailyBonus(){
const today=new Date().toDateString();
if(lastBonusDate===today){
ui.showNotification('Ya reclamaste tu bono hoy','error');
return;
}
currentUser.coins+=CONFIG.DAILY_BONUS;
lastBonusDate=today;
stateManager.updateCoinsDisplay();
stateManager.saveUserData();
ui.showNotification(`+${CONFIG.DAILY_BONUS} monedas`,'success');
}
elements.authForm.addEventListener('submit',e=>{
e.preventDefault();
const name=elements.userNameInput.value.trim();
if(!name)return;
if(!stateManager.loadUserData()||currentUser.name!==name){
currentUser={name,coins:CONFIG.REGISTRATION_BONUS};
unlockedContent.clear();
favoriteContent.clear();
lastBonusDate=null;
}
stateManager.saveUserData();
ui.showPlatform();
});
elements.logoutBtn.addEventListener('click',()=>{
currentUser=null;
elements.authScreen.classList.remove('hidden');
elements.mainHeader.classList.add('hidden');
elements.heroSection.classList.add('hidden');
elements.mainContent.classList.add('hidden');
});
elements.dailyBonusBtn.addEventListener('click',claimDailyBonus);
elements.tabBtns.forEach(b=>b.addEventListener('click',()=>ui.showSection(b.dataset.section)));
elements.closeModal.addEventListener('click',()=>elements.contentModal.classList.add('hidden'));
elements.modalUnlockBtn.addEventListener('click',unlockContent);
elements.modalFavoriteBtn.addEventListener('click',toggleFavorite);
if(stateManager.loadUserData())ui.showPlatform();
