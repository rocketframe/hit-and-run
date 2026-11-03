const {chromium}=require('playwright'); const fs=require('fs');
const old=fs.readFileSync(process.env.SP+'/oldai.js','utf8').replace('function aiThink(p)','(function(p)').replace(/\}\s*$/,'})');
(async()=>{
 const b=await chromium.launch(); const pg=await b.newPage();
 pg.on('pageerror',e=>console.log('ERR',e.message));
 await pg.goto('file:///home/claude/hitandrun/index.html');
 const [np,diff,bot,runs,army]=[+process.argv[2],+process.argv[3],process.argv[4],+(process.argv[5]||3),+(process.argv[6]||30)];
 for(let i=0;i<runs;i++){
  await pg.evaluate(([np,diff,army])=>{const h=window.__hr; h.UI.opts.players=np; h.UI.opts.diff=diff; h.UI.opts.army=army; h.start(); h.UI.paused=true;},[np,diff,army]);
  const r=await pg.evaluate(([old,bot])=>{const h=window.__hr,G=h.G; const me=G.players[0]; me.ai=true;
    if(bot==='smart'){me.smart=true;} else me.think = bot==='turtle' ? (()=>{}) : h.evalIn(old);
    let t=0; while(!G.over && t<30*60*15){h.step();t++;}
    return {t:G.time|0, win:G.over?G.over.win:null, pl:G.players.map(p=>`${p.team.name} L${p.level+1} k${p.kills} b${p.base.hp|0}${p.out?' OUT':''}`).join(' | ')};},[old,bot]);
  console.log(JSON.stringify(r));
 }
 await b.close();
})();
