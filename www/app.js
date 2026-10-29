'use strict';
const KEY='scommesse2.bettracker.v1';
let db={tickets:[],results:{}};
try{const x=JSON.parse(localStorage.getItem(KEY));if(x&&Array.isArray(x.tickets))db={tickets:x.tickets,results:x.results||{}}}catch{}
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const key=e=>e.id_partita||e.match_id||[e.data_partita||e.date||'',norm(e.casa||e.home),norm(e.trasferta||e.away)].join('|');
const labels={won:'🟢 Vinta',lost:'🔴 Persa',pending:'🟡 In attesa',void:'🔵 Annullata',unknown:'⚪ Da verificare'};
function evaluate(e,r){
if(!r||r.status==='scheduled'||r.status==='live')return 'pending';
if(r.status==='void')return 'void';
if(r.status!=='finished')return 'unknown';
const h=Number(r.home),a=Number(r.away),total=h+a,m=String(e.mercato||e.market||'').trim().toUpperCase().replace(/,/g,'.').replace(/\s+/g,' ');
// Mercati combinati: ogni componente deve essere verificabile e vincente.
if(/\s*\+\s*/.test(m)){
const parts=m.split(/\s*\+\s*/).map(x=>x.trim()).filter(Boolean);
if(parts.length>1){
const outcomes=parts.map(part=>evaluate({...e,mercato:part,market:part},r));
if(outcomes.includes('lost'))return 'lost';
if(outcomes.includes('unknown'))return 'unknown';
if(outcomes.includes('pending'))return 'pending';
if(outcomes.every(x=>x==='void'))return 'void';
return 'won';
}
}
let ok;
if(m==='1')ok=h>a;else if(m==='X')ok=h===a;else if(m==='2')ok=h<a;else if(/^DNB\s*[12]$/.test(m)||/^[12]\s*DNB$/.test(m)){if(h===a)return 'void';const side=m.includes('1')?1:2;ok=side===1?h>a:a>h;}else if(m==='1X')ok=h>=a;else if(m==='X2')ok=h<=a;else if(m==='12')ok=h!==a;
else if(['GOAL','GG','BTTS SI','BTTS SÌ'].includes(m))ok=h>0&&a>0;
else if(['NO GOAL','NOGOAL','NG','BTTS NO'].includes(m))ok=h===0||a===0;
else{let z=m.match(/^(OVER|UNDER)\s*(\d+(?:\.\d+)?)$/);if(z)ok=z[1]==='OVER'?total>Number(z[2]):total<Number(z[2]);
else{z=m.match(/^MULTIGOL\s*(\d+)\s*[-–]\s*(\d+)$/);if(z)ok=total>=Number(z[1])&&total<=Number(z[2]);
else{z=m.match(/^(?:1T|HT)\s+(OVER|UNDER)\s*(\d+(?:\.\d+)?)$/);if(z&&r.htHome!=null&&r.htAway!=null){const t=Number(r.htHome)+Number(r.htAway);ok=z[1]==='OVER'?t>Number(z[2]):t<Number(z[2]);}}}}
return ok===undefined?'unknown':ok?'won':'lost';
}
function stateOf(s){if(s.includes('lost'))return 'lost';if(s.includes('unknown'))return 'unknown';if(s.includes('pending'))return 'pending';if(s.every(x=>x==='void'))return 'void';return 'won'}
function save(){localStorage.setItem(KEY,JSON.stringify(db));render()}
function render(){
let win=0,lose=0,pending=0;const root=$('list');root.innerHTML='';
for(const [i,t] of db.tickets.entries()){
const events=t.eventi,states=events.map(e=>evaluate(e,db.results[key(e)])),st=stateOf(states);
if(st==='won')win++;else if(st==='lost')lose++;else pending++;
const odds=events.reduce((v,e,j)=>v*(states[j]==='void'?1:Number(e.quota||e.odds||1)),1),stake=Number(t.puntata||0);
const box=document.createElement('article');box.className='ticket';
box.innerHTML='<div class="row"><h3>'+esc(t.nome||'Schedina')+' <small class="'+st+'">'+labels[st]+'</small></h3><button class="secondary" data-remove="'+i+'">Elimina</button></div><p class="muted">'+events.length+' eventi · Quota '+fmt(odds)+' · Puntata € '+fmt(stake)+' · Ritorno potenziale € '+fmt(stake*odds)+' · Utile potenziale € '+fmt(stake*(odds-1))+'</p><label>Puntata (€) <input type="number" min="0" step="0.01" value="'+stake+'" data-stake="'+i+'"></label>';
for(const e of events){const k=key(e),r=db.results[k],s=evaluate(e,r),el=document.createElement('div');el.className='event';
el.innerHTML='<div class="row"><div><b>'+esc(e.casa||e.home)+' – '+esc(e.trasferta||e.away)+'</b><br><small>'+esc(e.campionato||'')+' · '+esc(e.data_partita||'')+' '+esc(e.ora||'')+'</small><br><small>Mercato: '+esc(e.mercato||e.market)+' · bwin '+fmt(e.quota||e.odds||1)+'</small><br><span class="'+s+'">'+labels[s]+'</span> '+(r?'<small>('+esc(r.home)+'-'+esc(r.away)+' · '+esc(r.status)+')</small>':'')+'</div><button class="secondary" data-match="'+esc(k)+'">Risultato</button></div>';box.appendChild(el)}
root.appendChild(box)}
if(!db.tickets.length)root.innerHTML='<p class="muted">Nessuna schedina importata.</p>';
$('stats').innerHTML='<div class="stat">Schedine<strong>'+db.tickets.length+'</strong></div><div class="stat">Vinte<strong class="won">'+win+'</strong></div><div class="stat">Perse<strong class="lost">'+lose+'</strong></div><div class="stat">In attesa / verifica<strong>'+pending+'</strong></div>';
}
$('importBtn').onclick=()=>$('file').click();
$('file').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{const j=JSON.parse(await f.text()),arr=Array.isArray(j)?j:Array.isArray(j.schedine)?j.schedine:[j];let n=0;for(const raw of arr){if(!Array.isArray(raw.eventi)||!raw.eventi.length)continue;const es=raw.eventi.filter(e=>(e.casa||e.home)&&(e.trasferta||e.away)&&(e.mercato||e.market)&&Number(e.quota||e.odds)>0);if(es.length!==raw.eventi.length)continue;const id=String(raw.id||JSON.stringify(es));if(db.tickets.some(t=>t.id===id))continue;db.tickets.push({...raw,id,eventi:es});n++}if(!n)throw Error('Nessuna schedina nuova valida');$('notice').textContent='Importate '+n+' schedine';save()}catch(err){$('notice').textContent='Errore: '+err.message}ev.target.value=''};
let selected=null;
$('list').onclick=e=>{const rm=e.target.closest('[data-remove]');if(rm){if(confirm('Eliminare la schedina?')){db.tickets.splice(Number(rm.dataset.remove),1);save()}return}
const btn=e.target.closest('[data-match]');if(!btn)return;selected=btn.dataset.match;const m=db.tickets.flatMap(t=>t.eventi).find(x=>key(x)===selected),r=db.results[selected];$('matchName').textContent=(m.casa||m.home)+' – '+(m.trasferta||m.away);$('homeGoals').value=r?.home??0;$('awayGoals').value=r?.away??0;$('htHome').value=r?.htHome??'';$('htAway').value=r?.htAway??'';$('matchStatus').value=r?.status||'finished';$('editDialog').showModal()};
$('resultForm').onsubmit=e=>{if(e.submitter?.value!=='save'||!selected)return;const h=Number($('homeGoals').value),a=Number($('awayGoals').value),hh=$('htHome').value,ha=$('htAway').value;if(h<0||a<0||!Number.isInteger(h)||!Number.isInteger(a)){e.preventDefault();return}db.results[selected]={home:h,away:a,htHome:hh===''?null:Number(hh),htAway:ha===''?null:Number(ha),status:$('matchStatus').value};save()};
$('list').onchange=e=>{if(e.target.matches('[data-stake]')){db.tickets[Number(e.target.dataset.stake)].puntata=Math.max(0,Number(e.target.value)||0);save()}};
$('clearBtn').onclick=()=>{if(confirm('Eliminare archivio e risultati?')){db={tickets:[],results:{}};save()}};
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='scommesse2-archivio.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
render();

const LEAGUES={
'seriea':'ita.1','serieb':'ita.2','coppa italia':'ita.coppa_italia','coppaitalia':'ita.coppa_italia','supercoppa italiana':'ita.super_cup',
'premierleague':'eng.1','championship':'eng.2','leagueone':'eng.3','leaguetwo':'eng.4','nationalleague':'eng.5','eflcup':'eng.league_cup','carabaocup':'eng.league_cup','leaguecup':'eng.league_cup','facup':'eng.fa','fa cup':'eng.fa','communityshield':'eng.charity',
'laliga':'esp.1','liga':'esp.1','laliga2':'esp.2','segundadivision':'esp.2','copadelrey':'esp.copa_del_rey','supercopa':'esp.super_cup',
'bundesliga':'ger.1','2bundesliga':'ger.2','dfbpokal':'ger.dfb_pokal','ligue1':'fra.1','ligue2':'fra.2','coupedefrance':'fra.coupe_de_france',
'eredivisie':'ned.1','eerstedivisie':'ned.2','knvbbeker':'ned.cup','primeiraliga':'por.1','ligaportugal':'por.1','tacadeportugal':'por.taca_de_portugal',
'belgianproleague':'bel.1','scottishpremiership':'sco.1','scottishcup':'sco.fa','superlig':'tur.1','superligaturca':'tur.1','superleaguegrecia':'gre.1',
'championsleague':'uefa.champions','uefachampionsleague':'uefa.champions','europaleague':'uefa.europa','uefaeuropaleague':'uefa.europa','conferenceleague':'uefa.europa.conf','uefaconferenceleague':'uefa.europa.conf','uefasupercup':'uefa.super_cup','nationsleague':'uefa.nations',
'worldcup':'fifa.world','mondiali':'fifa.world','europeanchampionship':'uefa.euro','euro':'uefa.euro','copalibertadores':'conmebol.libertadores','copasudamericana':'conmebol.sudamericana',
'brasileiraoseriea':'bra.1','brasileirao':'bra.1','argentinaprimera':'arg.1','mls':'usa.1','ligamx':'mex.1','saudiproleague':'ksa.1'
};
const EXTRA_LEAGUES=['eng.league_cup','eng.fa','ita.coppa_italia','esp.copa_del_rey','ger.dfb_pokal','fra.coupe_de_france','uefa.champions','uefa.europa','uefa.europa.conf','eng.1','ita.1','esp.1','ger.1','fra.1'];
const TEAM_ALIASES={'internazionale':'inter','intermilan':'inter','acmilan':'milan','asroma':'roma','ssclazio':'lazio','napoli':'napoli','sscnapoli':'napoli','manchesterunited':'manutd','manutd':'manutd','manchestercity':'mancity','mancity':'mancity','parissaintgermain':'psg','psg':'psg','bayernmunich':'bayern','bayernmunchen':'bayern','bayern':'bayern','atleticomadrid':'atletico','atleticodemadrid':'atletico','atletico':'atletico','fcbarcelona':'barcelona','realmadridcf':'realmadrid','juventusfc':'juventus','arsenalfc':'arsenal','chelseafc':'chelsea','liverpoolfc':'liverpool','tottenhamhotspur':'tottenham','rbleipzig':'leipzig','rblipsia':'leipzig','rblipsia':'leipzig','leipzig':'leipzig','rotweissessen':'essen','rotweissessen':'essen','rwessen':'essen','fleetwoodtown':'fleetwood','fleetwood':'fleetwood','arsenal':'arsenal','werderbrema':'werderbremen','svwerderbremen':'werderbremen','werderbremen':'werderbremen','borussiadortmund':'dortmund','bvbdortmund':'dortmund','dortmund':'dortmund'};
const teamNorm=s=>{const n=norm(s);return TEAM_ALIASES[n]||n.replace(/^(fc|ac|as|ssc|ss|cf)/,'').replace(/(fc|cf)$/,'')};
function eventDate(e){const d=String(e.data_partita||e.date||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)?d.replace(/-/g,''):null}
function leagueOf(e){const s=norm(e.campionato||e.league||'');return LEAGUES[s]||null}
function statusOf(t){const n=String(t?.name||'').toLowerCase(),st=String(t?.state||'').toLowerCase();if(st==='post'||/final|full time|finished|terminat/.test(n))return 'finished';if(/postponed|cancelled|canceled|abandoned/.test(n))return 'void';if(st==='in'||/half|live|progress/.test(n))return 'live';return 'scheduled'}
function parseGame(g){const c=g?.competitions?.[0];if(!c)return null;const home=c.competitors?.find(x=>x.homeAway==='home'),away=c.competitors?.find(x=>x.homeAway==='away');if(!home||!away)return null;const hs=c.details?.find(x=>/halftime/i.test(x?.type?.text||''));return {id:g.id,date:String(g.date||'').slice(0,10).replace(/-/g,''),homeNames:[home.team?.displayName,home.team?.shortDisplayName,home.team?.name,home.team?.abbreviation],awayNames:[away.team?.displayName,away.team?.shortDisplayName,away.team?.name,away.team?.abbreviation],home:Number(home.score||0),away:Number(away.score||0),status:statusOf(c.status?.type||g.status?.type),minute:g.status?.displayClock||g.status?.type?.shortDetail||'',htHome:null,htAway:null}}
function matches(e,g){const d=eventDate(e);if(!d||Math.abs((Date.UTC(+d.slice(0,4),+d.slice(4,6)-1,+d.slice(6,8))-Date.UTC(+g.date.slice(0,4),+g.date.slice(4,6)-1,+g.date.slice(6,8)))/86400000)>1)return false;const a=teamNorm(e.casa||e.home),b=teamNorm(e.trasferta||e.away);return g.homeNames.some(n=>teamNorm(n)===a)&&g.awayNames.some(n=>teamNorm(n)===b)}

// Fonte secondaria: TheSportsDB. Ricerca mirata soltanto sugli incontri rimasti senza risultato.
const secondaryCache=new Map();
async function jsonFromSource(url){
const native=window.Capacitor?.Plugins?.CapacitorHttp?.get;
const response=native?await native({url,headers:{Accept:'application/json'}}):await fetch(url,{cache:'no-store'});
if(response.status<200||response.status>=300)throw Error('HTTP '+response.status);
return typeof response.json==='function'?await response.json():response.data;
}
function secondaryGame(x){
if(!x||String(x.strSport||'').toLowerCase()!=='soccer')return null;
const home=Number(x.intHomeScore),away=Number(x.intAwayScore);
if(!Number.isFinite(home)||!Number.isFinite(away)||x.intHomeScore==null||x.intAwayScore==null)return null;
const d=String(x.dateEvent||'').replace(/-/g,'');
return {date:d,homeNames:[x.strHomeTeam],awayNames:[x.strAwayTeam],home,away,status:/postponed|cancelled|abandoned/i.test(x.strStatus||'')?'void':'finished',source:'TheSportsDB'};
}
async function secondaryLookup(e){
const date=eventDate(e);if(!date)return null;
const h=String(e.casa||e.home||'').trim(),a=String(e.trasferta||e.away||'').trim();
const query=h+'_vs_'+a,cacheKey=norm(query)+'|'+date;
const cached=secondaryCache.get(cacheKey);
if(cached&&Date.now()-cached.at<10*60*1000)return cached.game;
const iso=date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8);
const queries=[query,teamNorm(h)+'_vs_'+teamNorm(a),h.replace(/Brema/ig,'Bremen')+'_vs_'+a.replace(/Brema/ig,'Bremen'),h+'_vs_'+a.replace(/Brema/ig,'Bremen')];
let games=[];for(const q of [...new Set(queries)]){const url='https://www.thesportsdb.com/api/v1/json/123/searchevents.php?e='+encodeURIComponent(q);const data=await jsonFromSource(url);games.push(...(Array.isArray(data?.event)?data.event:Array.isArray(data?.events)?data.events:[]).map(secondaryGame).filter(Boolean));if(games.some(g=>matches(e,g)))break;}
const candidates=games.filter(g=>matches(e,g));
const game=candidates.length===1?candidates[0]:null;
secondaryCache.set(cacheKey,{at:Date.now(),game});
return game;
}
let syncing=false,lastSync=0;
async function updateScores(manual=false){
if(syncing)return;if(!db.tickets.length){$('notice').textContent='Importa prima una schedina';return}
const events=[...new Map(db.tickets.flatMap(t=>t.eventi).map(e=>[key(e),e])).values()];
const groups=new Map();for(const e of events){const league=leagueOf(e),date=eventDate(e);if(!league||!date)continue;const id=league+'|'+date;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(e)}
const unclassified=events.filter(e=>!leagueOf(e)&&eventDate(e));for(const e of unclassified){const date=eventDate(e);for(const league of EXTRA_LEAGUES){const id=league+'|'+date;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(e)}}
if(!groups.size){$('notice').textContent='Nessuna partita riconosciuta: controlla campionato e formato data (AAAA-MM-GG)';return}
syncing=true;$('refreshBtn').disabled=true;$('notice').textContent='Aggiornamento risultati in corso…';let changed=0,errors=0,found=0;const unsupported=events.filter(e=>!eventDate(e)).length;const matchedKeys=new Set();
for(const [group,es] of groups){const [league,date]=group.split('|');try{
const url='https://site.api.espn.com/apis/site/v2/sports/soccer/'+league+'/scoreboard?dates='+date+'&limit=100';
const response=await (window.Capacitor?.Plugins?.CapacitorHttp?.get ? window.Capacitor.Plugins.CapacitorHttp.get({url,headers:{Accept:'application/json'}}) : fetch(url,{cache:'no-store'}));if(response.status<200||response.status>=300)throw Error('HTTP '+response.status);
const data=typeof response.json==='function'?await response.json():response.data;if(!Array.isArray(data.events))throw Error('Risposta non valida');
const games=data.events.map(parseGame).filter(Boolean);
for(const e of es){const candidates=games.filter(g=>matches(e,g));if(candidates.length!==1)continue;if(db.results[key(e)]?.source==='ESPN'&&db.results[key(e)]?.updatedAt&&new Date(db.results[key(e)].updatedAt).getTime()>Date.now()-10000)continue;found++;const g=candidates[0],k=key(e),old=db.results[k];matchedKeys.add(k);if(old?.status==='finished'&&g.status!=='finished')continue;
const r={home:g.home,away:g.away,status:g.status,htHome:old?.htHome??null,htAway:old?.htAway??null,minute:g.minute,source:'ESPN',updatedAt:new Date().toISOString()};
if(JSON.stringify([old?.home,old?.away,old?.status,old?.minute])!==JSON.stringify([r.home,r.away,r.status,r.minute]))changed++;
db.results[k]=r;
}
}catch(err){errors++;console.warn('ESPN',group,err)}}
let fallbackFound=0,fallbackErrors=0;
const remaining=events.filter(e=>eventDate(e)&&!matchedKeys.has(key(e))&&db.results[key(e)]?.status!=='finished');
for(const e of remaining.slice(0,8)){
try{const g=await secondaryLookup(e);if(!g)continue;
const k=key(e),old=db.results[k];if(old?.status==='finished')continue;
db.results[k]={home:g.home,away:g.away,status:g.status,htHome:old?.htHome??null,htAway:old?.htAway??null,source:'TheSportsDB',updatedAt:new Date().toISOString()};
matchedKeys.add(k);fallbackFound++;changed++;
}catch(err){fallbackErrors++;console.warn('TheSportsDB',key(e),err)}
}
lastSync=Date.now();$('lastSync').textContent='Ultimo controllo: '+new Date(lastSync).toLocaleTimeString('it-IT');$('notice').textContent='ESPN: '+found+' · Seconda fonte: '+fallbackFound+' · Non supportate: '+unsupported+' · Non trovate: '+(events.length-matchedKeys.size-unsupported)+' · Risultati modificati: '+changed+(errors?' · Errori ESPN: '+errors:'')+(fallbackErrors?' · Errori seconda fonte: '+fallbackErrors:'')+(errors===groups.size?' · Verifica la connessione o il servizio':'');save();syncing=false;$('refreshBtn').disabled=false;
}
$('refreshBtn').onclick=()=>updateScores(true);
const autoTimer=setInterval(()=>{if($('autoRefresh').checked&&!document.hidden&&Date.now()-lastSync>=60000)updateScores()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('autoRefresh').checked&&Date.now()-lastSync>=60000)updateScores()});
setTimeout(()=>{if($('autoRefresh').checked&&db.tickets.length)updateScores()},1800);
