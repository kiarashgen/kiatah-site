/* Canonical page navigation; fragment identifiers are only section anchors. */
(() => {
  const source=document.querySelector('[data-site-metadata]');
  if(!source)return;
  const pages=JSON.parse(source.textContent);
  function update(route){
    const data=pages[route];if(!data)return;
    document.title=data.title;
    document.querySelector('meta[name="description"]').content=data.description;
    document.querySelector('link[rel="canonical"]').href='https://kiatah.com'+data.path;
    for(const [name,value] of Object.entries({'og:title':data.title,'og:description':data.description,'og:url':'https://kiatah.com'+data.path,'og:image':'https://kiatah.com'+data.image}))document.querySelector(`meta[property="${name}"]`).content=value;
    for(const link of document.querySelectorAll('a[data-route]')){
      const path=window.KTRoutes[link.dataset.route];if(path)link.href=path+(link.dataset.target?'#'+link.dataset.target:'');
    }
  }
  addEventListener('site:route',e=>update(e.detail.route));
  const active=document.querySelector('main>.page.active');if(active)update(active.id);
  let pending=false;
  new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;const active=document.querySelector('main>.page.active');if(active)update(active.id);});}).observe(document.querySelector('main'),{childList:true,subtree:true});
})();
