/* The dome's 3D code loads only when its workspace approaches the viewport. */
const workspace=document.querySelector('#muqarnas');
if(workspace){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();import('/scripts/muqarnas-generator.js').catch(()=>{workspace.querySelector('.mq-loading').textContent='The model could not load. Refresh the page to try again.';});}},{rootMargin:'250px'});observer.observe(workspace);}
