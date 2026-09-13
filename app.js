import {dates, latest, period, series} from './metrics.js';
const $ = selector => document.querySelector(selector);
const format = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US').format(value);
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {stars:'Stars', forks:'Forks', prs:'Pull requests', issues:'Issues', downloads:'PyPI downloads'};
const icons = {stars:'☆',forks:'⑂',prs:'⇄',issues:'◎',downloads:'↓'};
let data, days = 30, metric = 'downloads', sort = 'stars', direction = -1;
const selected = () => data.projects.filter(p => $('#project').value === 'all' || p.name === $('#project').value);
const range = () => dates(data.updatedAt.slice(0,10), days);
function render() {
  const projects = selected(), span = range();
  $('#cards').innerHTML = Object.keys(labels).map(key => {
    const result = period(projects, span, key);
    const value = ['stars','forks'].includes(key) ? projects.reduce((s,p) => s + (latest(p)[key] || 0), 0) : result.value;
    let note = ['stars','forks'].includes(key) ? `${result.value === null ? 'History starts with the first snapshot' : `${result.value > 0 ? '+' : ''}${format(result.value)} net change in period`}` : `in selected period${result.partial ? ' · partial' : ''}`;
    if (['prs','issues'].includes(key)) note += ` · ${format(projects.reduce((s,p)=>s+(latest(p)[key === 'prs' ? 'openPrs' : 'openIssues'] || 0),0))} open`;
    if (['stars','forks'].includes(key) && result.value !== null && result.partial) note += ' · partial';
    return `<article class="card ${key === 'downloads' ? 'accent-card' : ''}"><div class="card-top">${labels[key]}<span>${icons[key]}</span></div><strong>${format(value)}</strong><small>${note}</small></article>`;
  }).join('');
  drawChart(projects, span);
  renderTable();
  $('#range-label').textContent = `${span[0]} — ${span.at(-1)} UTC`;
}
function drawChart(projects, span) {
  const buckets = series(projects, span, metric, $('#group').value);
  $('#chart-title').textContent = labels[metric] + (['stars','forks'].includes(metric) ? ' · net change' : '');
  document.querySelectorAll('[data-metric]').forEach(b => { b.classList.toggle('active', b.dataset.metric === metric); b.setAttribute('aria-pressed', b.dataset.metric === metric); });
  const known = buckets.filter(b => b.value !== null);
  $('#chart-note').textContent = buckets.some(b => b.known < b.expected) ? 'Partial data · gaps are not counted as zero' : 'Daily data · UTC';
  if (!known.length) { $('#chart').innerHTML = `<div class="empty"><span>◷</span><h3>History starts here</h3><p>${metric === 'downloads' ? 'No download data is available for the selected period and projects.' : 'Changes will appear after two consecutive daily snapshots.'}</p></div>`; return; }
  const width = 1100, height = 250, left = 58, right = 12, top = 18, bottom = 34;
  const max = Math.max(1, ...known.map(b => b.value)), min = Math.min(0, ...known.map(b => b.value));
  const y = v => top + (max-v)/(max-min)*(height-top-bottom);
  const step = (width-left-right)/buckets.length;
  const lines = Array.from({length:5},(_,i) => { const v = min+(max-min)*i/4; return `<line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}" stroke="#e9ece6"/><text x="${left-12}" y="${y(v)+4}" text-anchor="end">${format(Math.round(v))}</text>`; }).join('');
  const bars = buckets.map((b,i) => b.value === null ? '' : `<rect x="${left+i*step+step*.16}" y="${Math.min(y(b.value),y(0))}" width="${Math.max(.5,step*.68)}" height="${Math.max(1,Math.abs(y(0)-y(b.value)))}" rx="${Math.min(3,step/5)}" fill="${b.value < 0 ? '#ce725e' : '#6f8e51'}" opacity="${b.known < b.expected ? '.45' : '1'}"><title>${b.label}: ${format(b.value)}${b.known < b.expected ? ' (partial)' : ''}</title></rect>`).join('');
  const indices = [...new Set([0,Math.floor((buckets.length-1)/3),Math.floor(2*(buckets.length-1)/3),buckets.length-1])];
  const ticks = indices.map(i=>`<text x="${left+(i+.5)*step}" y="${height-7}" text-anchor="${i===0?'start':i===buckets.length-1?'end':'middle'}">${buckets[i].label}</text>`).join('');
  $('#chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(labels[metric])}, from ${span[0]} to ${span.at(-1)}"><title>${labels[metric]} in selected period</title>${lines}${bars}${ticks}</svg><details class="chart-data"><summary>Show chart data</summary><div class="data-list">${buckets.map(b=>`<span>${b.label}</span><span>${format(b.value)}${b.known < b.expected ? ' · partial' : ''}</span>`).join('')}</div></details>`;
}
function rows() {
  return selected().filter(p=>p.name.toLowerCase().includes($('#search').value.toLowerCase())).map(p=>({p,name:p.name,stars:latest(p).stars,forks:latest(p).forks,...Object.fromEntries(['prs','issues','downloads'].map(k=>[k,period([p],range(),k).value]))})).sort((a,b)=>a[sort] === null ? (b[sort] === null ? 0 : 1) : b[sort] === null ? -1 : direction*(typeof a[sort] === 'string' ? a[sort].localeCompare(b[sort]) : a[sort]-b[sort]));
}
function renderTable() {
  const list = rows();
  $('#project-count').textContent = list.length;
  $('#projects').innerHTML = list.map(r=>`<tr><td><a class="project-name" href="${escape(r.p.url)}" target="_blank" rel="noopener">${escape(r.name)} <span>↗</span></a><div class="project-description">${escape(r.p.description)}</div><small class="language"><i></i>${escape(r.p.language || 'Resources')}</small></td>${['stars','forks','prs','issues','downloads'].map(k=>`<td class="number">${format(r[k])}${k==='downloads' && r[k] !== null && period([r.p],range(),k).partial ? '<small>partial</small>' : ''}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="6" class="no-results">No projects match your search.</td></tr>';
  document.querySelectorAll('[data-sort]').forEach(b=>b.closest('th').setAttribute('aria-sort', b.dataset.sort === sort ? (direction===1?'ascending':'descending') : 'none'));
}
$('#project').addEventListener('change',render);
$('#group').addEventListener('change',render);
$('#search').addEventListener('input',renderTable);
document.querySelectorAll('[data-days]').forEach(button=>button.addEventListener('click',()=>{days=Number(button.dataset.days);document.querySelectorAll('[data-days]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button);});render();}));
document.querySelectorAll('[data-metric]').forEach(button=>button.addEventListener('click',()=>{metric=button.dataset.metric;render();}));
document.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{direction=sort===button.dataset.sort?-direction:-1;sort=button.dataset.sort;renderTable();}));
$('#export').addEventListener('click',()=>{
  const escapeCsv = v => '"'+String(v??'').replace(/^[=+\-@]/,"'$&").replace(/"/g,'""')+'"';
  const header=['project','stars_total','forks_total','prs_created','issues_created','pypi_downloads','pypi_partial','from_utc','to_utc'];
  const csv=[header,...rows().map(r=>[r.name,r.stars,r.forks,r.prs,r.issues,r.downloads,period([r.p],range(),'downloads').partial,range()[0],range().at(-1)])].map(row=>row.map(escapeCsv).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`vstorm-oss-${days}d.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
try {
  const response=await fetch('./data/dashboard.json');if(!response.ok)throw new Error('Could not fetch data.');data=await response.json();
  $('#project').innerHTML += data.projects.map(p=>`<option value="${escape(p.name)}">${escape(p.name)}</option>`).join('');
  $('#status').textContent = `Updated: ${new Date(data.updatedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}`;
  $('#warnings').innerHTML=data.warnings.map(w=>`<li>${escape(w)}</li>`).join('');
  if(Date.now()-new Date(data.updatedAt)>2*86400000 || data.warnings.length){$('#error').hidden=false;$('#error').textContent=`${data.warnings.length ? 'Some sources are unavailable — available measurements have been retained. ' : ''}${Date.now()-new Date(data.updatedAt)>2*86400000 ? 'Data is more than 48 hours old. ' : ''}See the methodology section below for details.`;}
  render();
} catch(error) {$('#status').textContent='Data unavailable';$('#error').hidden=false;$('#error').textContent='Could not load data. Refresh the page or run the collector: python3 scripts/collect.py';document.querySelectorAll('button,select,input').forEach(el=>el.disabled=true);}
