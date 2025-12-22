const CONFIG={
TVMAZE_API:'https://api.tvmaze.com/shows',
JIKAN_API:'https://api.jikan.moe/v4/top/anime',
UNLOCK_COST:25,
DAILY_BONUS:10,
WELCOME_BONUS:300,
CACHE_DURATION:10*60*1000,
RETRY_DELAY:2000,
MAX_RETRIES:3
};
let currentUser=null;
let unlockedContent=new Set();
let lastBonusDate=null;
let currentModalContent=null;
let cache=new Map();
let isLoading=false;
let retryCount=0;
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
infoBtn:document.getElementById('infoBtn'),
mainContent:document.getElementById('mainContent'),
seriesSection:document.getElementById('seriesSection'),
animeSection:document.getElementById('animeSection'),
seriesGrid:document.getElementById('seriesGrid'),
animeGrid:document.getElementById('animeGrid'),
tabBtns:document.querySelectorAll('.tab-btn'),
contentModal:document.getElementById('contentModal'),
modalTitle:document.getElementById('modalTitle'),
modalPoster:document.getElementById('modalPoster'),
modalBadge:document.getElementById('modalBadge'),
modalType:document.getElementById('modalType'),
modalGenre:document.getElementById('modalGenre'),
modalRating:document.getElementById('modalRating'),
modalStatus:document.getElementById('modalStatus'),
modalDescription:document.getElementById('modalDescription'),
modalWatchBtn:document.getElementById('modalWatchBtn'),
modalUnlockBtn:document.getElementById('modalUnlockBtn'),
closeModal:document.getElementById('closeModal'),
unlockModal:document.getElementById('unlockModal'),
unlockMessage:document.getElementById('unlockMessage'),
closeUnlockModal:document.getElementById('closeUnlockModal'),
cancelUnlock:document.getElementById('cancelUnlock'),
confirmUnlock:document.getElementById('confirmUnlock'),
refreshSeries:document.getElementById('refreshSeries'),
refreshAnime:document.getElementById('refreshAnime'),
loadingOverlay:document.getElementById('loadingOverlay'),
notificationContainer:document.getElementById('notificationContainer'),
mainFooter:document.getElementById('mainFooter')
};
const utils={
debounce(func,wait){
let timeout;
return function executedFunction(...args){
const later=()=>{
clearTimeout(timeout);
func(...args);
};
clearTimeout(timeout);
timeout=setTimeout(later,wait);
};
},
generateAvatar(name){
return name.charAt(0).toUpperCase();
},
formatNumber(num){
return num.toLocaleString('es-ES');
},
getCacheKey(key){
const userId=currentUser?.id||'guest';
return `mediahub_${userId}_${key}`;
},
saveToCache(key,data,duration=CONFIG.CACHE_DURATION){
const cacheItem={
data,
timestamp:Date.now(),
duration
};
cache.set(key,cacheItem);
localStorage.setItem(this.getCacheKey(key),JSON.stringify(cacheItem));
},
getFromCache(key){
if(cache.has(key)){
const item=cache.get(key);
if(Date.now()-item.timestamp<item.duration){
return item.data;
}
cache.delete(key);
}
const stored=localStorage.getItem(this.getCacheKey(key));
if(stored){
try{
const item=JSON.parse(stored);
if(Date.now()-item.timestamp<item.duration){
cache.set(key,item);
return item.data;
}
localStorage.removeItem(this.getCacheKey(key));
}catch(e){
console.error('Error reading cache:',e);
}
}
return null;
},
clearCache(key){
cache.delete(key);
localStorage.removeItem(this.getCacheKey(key));
},
clearAllCache(){
cache.clear();
const keys=Object.keys(localStorage);
keys.forEach(key=>{
if(key.startsWith('mediahub_')){
localStorage.removeItem(key);
}
});
},
handleApiError(error,retryFunction){
console.error('API Error:',error);
if(error.name==='TypeError'&&error.message.includes('fetch')){
ui.showNotification('Error de conexión. Verifica tu internet.','error');
return;
}
if(retryCount<CONFIG.MAX_RETRIES){
retryCount++;
ui.showNotification(`Reintentando... (${retryCount}/${CONFIG.MAX_RETRIES})`,'info');
setTimeout(retryFunction,CONFIG.RETRY_DELAY);
}else{
ui.showNotification('Error al cargar contenido. Intenta más tarde.','error');
}
}
};
const stateManager={
saveUserData(){
if(!currentUser)return;
const data={
user:currentUser,
unlocked:Array.from(unlockedContent),
lastBonus:lastBonusDate
};
localStorage.setItem('mediahub_user_data',JSON.stringify(data));
},
loadUserData(){
try{
const saved=localStorage.getItem('mediahub_user_data');
if(!saved)return false;
const data=JSON.parse(saved);
currentUser=data.user;
unlockedContent=new Set(data.unlocked||[]);
lastBonusDate=data.lastBonus||null;
return true;
}catch(error){
console.error('Error loading user data:',error);
return false;
}
},
clearUserData(){
currentUser=null;
unlockedContent.clear();
lastBonusDate=null;
localStorage.removeItem('mediahub_user_data');
utils.clearAllCache();
},
updateCoinsDisplay(){
if(!currentUser)return;
elements.coinsAmount.textContent=utils.formatNumber(currentUser.coins);
elements.userCoins.textContent=`${utils.formatNumber(currentUser.coins)} monedas`;
this.updateUnlockButtons();
},
updateUnlockButtons(){
document.querySelectorAll('.unlock-btn,.card-btn[data-action="unlock"]').forEach(btn=>{
const cost=parseInt(btn.dataset.cost)||CONFIG.UNLOCK_COST;
btn.disabled=currentUser.coins<cost;
btn.title=currentUser.coins<cost?
`Necesitas ${cost} monedas`:
`Desbloquear por ${cost} monedas`;
});
},
checkDailyBonus(){
if(!currentUser)return;
const today=new Date().toDateString();
if(lastBonusDate!==today){
elements.dailyBonusBtn.classList.remove('disabled');
elements.dailyBonusBtn.disabled=false;
}else{
elements.dailyBonusBtn.classList.add('disabled');
elements.dailyBonusBtn.disabled=true;
}
},
canAfford(cost){
return currentUser&&currentUser.coins>=cost;
},
deductCoins(amount){
if(!this.canAfford(amount))return false;
currentUser.coins-=amount;
this.updateCoinsDisplay();
this.saveUserData();
return true;
},
addCoins(amount){
if(!currentUser)return false;
currentUser.coins+=amount;
this.updateCoinsDisplay();
this.saveUserData();
return true;
}
};
const ui={
showLoading(){
if(isLoading)return;
isLoading=true;
elements.loadingOverlay.classList.remove('hidden');
},
hideLoading(){
isLoading=false;
elements.loadingOverlay.classList.add('hidden');
},
showNotification(message,type='info',duration=3000){
const notification=document.createElement('div');
notification.className=`notification ${type}`;
notification.innerHTML=`
<i class="fas fa-${type==='success'?'check-circle':
type==='error'?'exclamation-circle':
'info-circle'}"></i>
<span>${message}</span>
`;
elements.notificationContainer.appendChild(notification);
setTimeout(()=>{
notification.style.animation='slideInLeft 0.3s ease reverse';
setTimeout(()=>notification.remove(),300);
},duration);
},
showPlatform(){
elements.authScreen.classList.add('hidden');
elements.mainHeader.classList.remove('hidden');
elements.heroSection.classList.remove('hidden');
elements.mainContent.classList.remove('hidden');
elements.mainFooter.classList.remove('hidden');
elements.userAvatar.textContent=utils.generateAvatar(currentUser.name);
elements.userDisplayName.textContent=currentUser.name;
stateManager.updateCoinsDisplay();
stateManager.checkDailyBonus();
this.loadInitialContent();
},
showSection(sectionId){
[elements.seriesSection,elements.animeSection].forEach(s=>{
s.classList.add('hidden');
});
const section=document.getElementById(`${sectionId}Section`);
if(section){
section.classList.remove('hidden');
}
elements.tabBtns.forEach(btn=>{
btn.classList.remove('active');
if(btn.dataset.section===sectionId){
btn.classList.add('active');
}
});
},
showContentModal(content,type){
currentModalContent={content,type};
const contentId=content.id||content.mal_id;
const cacheKey=`${type}_${contentId}`;
const isUnlocked=unlockedContent.has(cacheKey);
elements.modalTitle.textContent=isUnlocked?
(content.name||content.title):
'🔒 Contenido Bloqueado';
const imageUrl=content.image?.medium||
content.images?.jpg?.large_image_url||
'favicon.jpg';
elements.modalPoster.src=imageUrl;
elements.modalPoster.alt=content.name||content.title||'Poster';
elements.modalPoster.onerror=function(){
this.src='favicon.jpg';
};
elements.modalType.textContent=type==='series'?'📺 Serie TV':'👻 Anime';
elements.modalGenre.textContent=type==='series'?
(content.genres?.[0]||'General'):
(content.genres?.[0]?.name||'General');
elements.modalRating.textContent=isUnlocked?
(type==='series'?
(content.rating?.average?`⭐ ${content.rating.average}/10`:'N/A'):
(content.score?`⭐ ${content.score}/10`:'N/A')):
'❓ ???';
elements.modalStatus.textContent=isUnlocked?
(content.status||'Desconocido'):
'🔒 Bloqueado';
elements.modalDescription.textContent=isUnlocked?
(type==='series'?
(content.summary?content.summary.replace(/<[^>]*>/g,''):'Sin descripción disponible.'):
(content.synopsis||'Sin sinopsis disponible.')):
'Este contenido está bloqueado. Desbloquéalo para ver la descripción completa y acceder a todas las funciones.';
elements.modalBadge.textContent=isUnlocked?'🔓 Desbloqueado':'🔒 Bloqueado';
elements.modalBadge.style.background=isUnlocked?
'var(--success-green)':
'var(--error-red)';
elements.modalWatchBtn.style.display=isUnlocked?'flex':'none';
elements.modalUnlockBtn.style.display=isUnlocked?'none':'flex';
elements.modalUnlockBtn.disabled=!stateManager.canAfford(CONFIG.UNLOCK_COST);
elements.modalUnlockBtn.innerHTML=`
<i class="fas fa-unlock"></i>
Desbloquear (${CONFIG.UNLOCK_COST} monedas)
`;
elements.contentModal.classList.remove('hidden');
document.body.style.overflow='hidden';
},
showUnlockConfirmation(contentName,cost){
elements.unlockMessage.textContent=`¿Desbloquear "${contentName}" por ${cost} monedas?`;
elements.unlockModal.classList.remove('hidden');
return new Promise((resolve)=>{
const handleConfirm=()=>{
cleanup();
resolve(true);
};
const handleCancel=()=>{
cleanup();
resolve(false);
};
const cleanup=()=>{
elements.confirmUnlock.removeEventListener('click',handleConfirm);
elements.cancelUnlock.removeEventListener('click',handleCancel);
elements.closeUnlockModal.removeEventListener('click',handleCancel);
elements.unlockModal.classList.add('hidden');
};
elements.confirmUnlock.addEventListener('click',handleConfirm);
elements.cancelUnlock.addEventListener('click',handleCancel);
elements.closeUnlockModal.addEventListener('click',handleCancel);
});
},
async loadInitialContent(){
try{
ui.showLoading();
retryCount=0;
await Promise.all([
contentManager.fetchTVShows(),
contentManager.fetchAnime()
]);
}catch(error){
console.error('Error loading initial content:',error);
ui.showNotification('Error al cargar contenido','error');
}finally{
ui.hideLoading();
}
},
createSkeletonCards(count,container){
container.innerHTML='';
for(let i=0;i<count;i++){
const skeleton=document.createElement('div');
skeleton.className='content-card skeleton';
skeleton.style.height='350px';
container.appendChild(skeleton);
}
}
};
const contentManager={
async fetchTVShows(){
const cacheKey='tvmaze_shows';
const cached=utils.getFromCache(cacheKey);
if(cached){
this.displayTVShows(cached);
return cached;
}
try{
const response=await fetch(CONFIG.TVMAZE_API);
if(response.status===429){
throw new Error('Rate limit exceeded');
}
if(!response.ok){
throw new Error(`HTTP ${response.status}`);
}
const shows=await response.json();
const limitedShows=shows.slice(0,20);
utils.saveToCache(cacheKey,limitedShows);
this.displayTVShows(limitedShows);
retryCount=0;
return limitedShows;
}catch(error){
utils.handleApiError(error,()=>this.fetchTVShows());
throw error;
}
},
displayTVShows(shows){
ui.createSkeletonCards(8,elements.seriesGrid);
setTimeout(()=>{
elements.seriesGrid.innerHTML='';
shows.forEach(show=>{
const isUnlocked=unlockedContent.has(`series_${show.id}`);
const card=this.createContentCard(show,'series',isUnlocked);
elements.seriesGrid.appendChild(card);
});
},500);
},
async fetchAnime(){
const cacheKey='jikan_anime';
const cached=utils.getFromCache(cacheKey);
if(cached){
this.displayAnime(cached);
return cached;
}
try{
const response=await fetch(CONFIG.JIKAN_API);
if(response.status===429){
throw new Error('Rate limit exceeded');
}
if(!response.ok){
throw new Error(`HTTP ${response.status}`);
}
const data=await response.json();
const animeList=data.data.slice(0,20);
utils.saveToCache(cacheKey,animeList);
this.displayAnime(animeList);
retryCount=0;
return animeList;
}catch(error){
utils.handleApiError(error,()=>this.fetchAnime());
throw error;
}
},
displayAnime(animeList){
ui.createSkeletonCards(8,elements.animeGrid);
setTimeout(()=>{
elements.animeGrid.innerHTML='';
animeList.forEach(anime=>{
const isUnlocked=unlockedContent.has(`anime_${anime.mal_id}`);
const card=this.createContentCard(anime,'anime',isUnlocked);
elements.animeGrid.appendChild(card);
});
},500);
},
createContentCard(content,type,isUnlocked){
const contentId=type==='series'?content.id:content.mal_id;
const title=type==='series'?content.name:content.title;
const rating=type==='series'?
(content.rating?.average||'N/A'):
(content.score||'N/A');
const genre=type==='series'?
(content.genres?.[0]||'General'):
(content.genres?.[0]?.name||'General');
const imageUrl=type==='series'?
(content.image?.medium||'favicon.jpg'):
(content.images?.jpg?.large_image_url||'favicon.jpg');
const card=document.createElement('div');
card.className=`content-card ${isUnlocked?'':'blurred'}`;
card.dataset.id=contentId;
card.dataset.type=type;
card.innerHTML=`
<div class="card-img-container">
<img src="${imageUrl}"
alt="${title}"
class="card-img"
loading="lazy"
onerror="this.src='favicon.jpg'">
${!isUnlocked?`
<div class="censored-overlay">
<i class="fas fa-lock"></i>
<h3>Bloqueado</h3>
<p>${CONFIG.UNLOCK_COST} monedas</p>
</div>
`:''}
</div>
<div class="card-content">
<div class="card-header">
<h3 class="card-title">${isUnlocked?title:'🔒 Bloqueado'}</h3>
</div>
<div class="card-meta">
<span class="card-genre">${genre}</span>
<span class="card-rating">
<i class="fas fa-star"></i> ${isUnlocked?rating:'??'}
</span>
</div>
<div class="card-actions">
<button class="card-btn details-btn"
onclick="ui.showContentModal(${JSON.stringify(content).replace(/"/g,'&quot;')},'${type}')">
<i class="fas fa-eye"></i> Detalles
</button>
${!isUnlocked?`
<button class="card-btn unlock-btn"
data-cost="${CONFIG.UNLOCK_COST}"
onclick="unlockContent('${type}',${contentId},'${title.replace(/'/g,"\\'")}')">
<i class="fas fa-unlock"></i> ${CONFIG.UNLOCK_COST}
</button>
`:''}
</div>
</div>
`;
return card;
},
refreshContent(type){
if(type==='series'){
utils.clearCache('tvmaze_shows');
this.fetchTVShows();
}else if(type==='anime'){
utils.clearCache('jikan_anime');
this.fetchAnime();
}
}
};
async function claimDailyBonus(){
if(!currentUser)return;
const today=new Date().toDateString();
if(lastBonusDate===today){
ui.showNotification('Ya reclamaste tu bonificación hoy','error');
return;
}
if(stateManager.addCoins(CONFIG.DAILY_BONUS)){
lastBonusDate=today;
stateManager.saveUserData();
stateManager.checkDailyBonus();
ui.showNotification(`¡+${CONFIG.DAILY_BONUS} monedas diarias! Total: ${currentUser.coins}`,'success');
elements.dailyBonusBtn.innerHTML=`
<i class="fas fa-check"></i>
<span>¡Reclamado!</span>
`;
elements.dailyBonusBtn.disabled=true;
setTimeout(()=>{
elements.dailyBonusBtn.innerHTML=`
<i class="fas fa-gift"></i>
<span>Reclamar bonificación diaria (+${CONFIG.DAILY_BONUS})</span>
`;
},2000);
}
}
async function unlockContent(type,id,title='este contenido'){
if(!currentUser)return;
if(!stateManager.canAfford(CONFIG.UNLOCK_COST)){
ui.showNotification(
`Necesitas ${CONFIG.UNLOCK_COST} monedas. Tienes ${currentUser.coins}.`,
'error'
);
return;
}
const confirmed=await ui.showUnlockConfirmation(title,CONFIG.UNLOCK_COST);
if(!confirmed)return;
if(stateManager.deductCoins(CONFIG.UNLOCK_COST)){
const cacheKey=`${type}_${id}`;
unlockedContent.add(cacheKey);
stateManager.saveUserData();
updateUnlockedContentUI(type,id);
ui.showNotification(
`¡Desbloqueado! Gastaste ${CONFIG.UNLOCK_COST} monedas. Quedan: ${currentUser.coins}`,
'success'
);
}
}
function updateUnlockedContentUI(type,id){
const cacheKey=`${type}_${id}`;
if(currentModalContent&&
(currentModalContent.content.id==id||currentModalContent.content.mal_id==id)&&
currentModalContent.type===type){
ui.showContentModal(currentModalContent.content,type);
}
const cards=document.querySelectorAll(`.content-card[data-id="${id}"][data-type="${type}"]`);
cards.forEach(card=>{
card.classList.remove('blurred');
const overlay=card.querySelector('.censored-overlay');
if(overlay)overlay.remove();
const title=card.querySelector('.card-title');
if(title&&currentModalContent?.content){
title.textContent=type==='series'?
currentModalContent.content.name:
currentModalContent.content.title;
}
const rating=card.querySelector('.card-rating');
if(rating&&currentModalContent?.content){
const newRating=type==='series'?
(currentModalContent.content.rating?.average||'N/A'):
(currentModalContent.content.score||'N/A');
rating.innerHTML=`<i class="fas fa-star"></i> ${newRating}`;
}
const actions=card.querySelector('.card-actions');
if(actions){
const unlockBtn=actions.querySelector('.unlock-btn');
if(unlockBtn){
unlockBtn.remove();
const detailsBtn=document.createElement('button');
detailsBtn.className='card-btn details-btn';
detailsBtn.innerHTML='<i class="fas fa-eye"></i> Detalles';
detailsBtn.onclick=()=>{
if(currentModalContent?.content){
ui.showContentModal(currentModalContent.content,type);
}
};
actions.appendChild(detailsBtn);
}
}
});
}
function setupEventListeners(){
elements.authForm.addEventListener('submit',function(e){
e.preventDefault();
const userName=elements.userNameInput.value.trim();
if(!userName){
ui.showNotification('Ingresa un nombre de usuario','error');
return;
}
currentUser={
id:Date.now(),
name:userName,
coins:CONFIG.WELCOME_BONUS
};
stateManager.saveUserData();
ui.showNotification(`¡Bienvenido ${userName}! Recibes ${CONFIG.WELCOME_BONUS} monedas de regalo.`,'success');
ui.showPlatform();
});
elements.logoutBtn.addEventListener('click',()=>{
if(confirm('¿Estás seguro de que quieres cerrar sesión?')){
stateManager.clearUserData();
elements.mainHeader.classList.add('hidden');
elements.heroSection.classList.add('hidden');
elements.mainContent.classList.add('hidden');
elements.contentModal.classList.add('hidden');
elements.unlockModal.classList.add('hidden');
elements.mainFooter.classList.add('hidden');
elements.authScreen.classList.remove('hidden');
elements.userNameInput.value='';
document.body.style.overflow='auto';
ui.showNotification('Sesión cerrada correctamente','info');
}
});
elements.dailyBonusBtn.addEventListener('click',claimDailyBonus);
elements.infoBtn.addEventListener('click',()=>{
const unlockedCount=unlockedContent.size;
const coins=currentUser?.coins||0;
ui.showNotification(
`Monedas: ${coins} | Desbloqueos: ${unlockedCount}`,
'info'
);
});
elements.closeModal.addEventListener('click',()=>{
elements.contentModal.classList.add('hidden');
document.body.style.overflow='auto';
});
elements.modalUnlockBtn.addEventListener('click',()=>{
if(!currentModalContent)return;
const id=currentModalContent.content.id||currentModalContent.content.mal_id;
const title=currentModalContent.content.name||currentModalContent.content.title;
unlockContent(currentModalContent.type,id,title);
});
elements.modalWatchBtn.addEventListener('click',()=>{
ui.showNotification('Reproduciendo contenido... 🎬','success');
elements.contentModal.classList.add('hidden');
document.body.style.overflow='auto';
});
document.addEventListener('keydown',(e)=>{
if(e.key==='Escape'){
if(!elements.contentModal.classList.contains('hidden')){
elements.contentModal.classList.add('hidden');
document.body.style.overflow='auto';
}
if(!elements.unlockModal.classList.contains('hidden')){
elements.unlockModal.classList.add('hidden');
}
}
});
[elements.contentModal,elements.unlockModal].forEach(modal=>{
modal.addEventListener('click',(e)=>{
if(e.target===modal){
modal.classList.add('hidden');
if(modal===elements.contentModal){
document.body.style.overflow='auto';
}
}
});
});
elements.tabBtns.forEach(btn=>{
btn.addEventListener('click',()=>{
const section=btn.dataset.section;
ui.showSection(section);
});
});
elements.refreshSeries.addEventListener('click',()=>{
contentManager.refreshContent('series');
ui.showNotification('Series actualizadas','success');
});
elements.refreshAnime.addEventListener('click',()=>{
contentManager.refreshContent('anime');
ui.showNotification('Anime actualizado','success');
});
window.addEventListener('online',()=>{
ui.showNotification('Conexión restablecida','success');
});
window.addEventListener('offline',()=>{
ui.showNotification('Sin conexión a internet','error');
});
}
function init(){
if(stateManager.loadUserData()){
ui.showPlatform();
}
setupEventListeners();
if('serviceWorker' in navigator){
window.addEventListener('load',()=>{
navigator.serviceWorker.register('/sw.js').catch(error=>{
console.log('ServiceWorker registration failed:',error);
});
});
}
console.log('MediaHub v2.0 - Plataforma de streaming simplificada');
}
window.ui=ui;
window.contentManager=contentManager;
window.unlockContent=unlockContent;
document.addEventListener('DOMContentLoaded',init);