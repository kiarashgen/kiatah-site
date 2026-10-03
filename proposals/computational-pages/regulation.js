const query = document.getElementById('corpus-query');
const list = document.getElementById('corpus-results');
const detail = document.getElementById('corpus-detail');
const count = document.getElementById('corpus-count');
const video = document.getElementById('rag-video');
const caption = document.getElementById('rag-caption');

const translations = {
  0: {
    question: 'Which section and edition of the National Building Regulations is this text from?',
    answer: 'The generated target identifies Section 19, Energy Management in Buildings, fifth edition (1404), and names the Ministry and research centre involved in producing it.',
    source: 'The source context is the document’s opening bibliographic page. It identifies the title, edition, ministry and publishing bodies.'
  },
  12: {
    question: 'What is the purpose of the Section 19 regulations?',
    answer: 'The generated target says: improving energy efficiency in buildings and organising energy use according to the criteria in Section 19.',
    source: 'The introduction describes the law’s energy-efficiency aim and the attempt to manage building energy use against specified criteria.'
  },
  13: {
    question: 'What share of the country’s annual energy use does the document attribute to buildings?',
    answer: 'The generated target says: more than 40%. This is a claim in the source document and generated pair, not an independently verified current statistic.',
    source: 'The same introduction context used by record 12 contains the “more than 40%” sentence. These two questions reuse one passage.'
  }
};

const captionRanges = [
  { at: 0, text: '00:00 · The saved Section 19 assistant opens. The sidebar identifies a local Llama 3.1 model and Multilingual-E5 embeddings.' },
  { at: 10, text: '00:10 · Question entered: “What problems arise from a lack of airtightness?”' },
  { at: 16, text: '00:16 · The interface displays “Analyzing Regulation…” while it prepares a response.' },
  { at: 20, text: '00:20 · The answer names infiltration and exfiltration, then mentions indoor-air quality, energy use and occupants’ health.' },
  { at: 32, text: '00:32 · The source-document panel is expanded. The Persian extraction is broken into short fragments and is hard to read.' },
  { at: 39, text: '00:39 · The first returned extract is visibly labelled “Source 1 (Page 91).”' },
  { at: 47, text: '00:47 · The recording opens Mabhas19.pdf, the PDF used by this retrieval prototype, and moves through the source pages.' },
  { at: 58, text: '00:58 · Viewer page 91 (printed page 72) shows the airtightness and air-leakage section. It links lost conditioned air to increased building energy use.' },
  { at: 65, text: '01:05 · Back in the expanded source panel, “Source 1 (Page 91)” appears with the corresponding extracted passage.' },
  { at: 68, text: '01:08 · The panel continues to Source 4 (Page 50). Its extracted Persian text is also fragmented.' },
  { at: 75, text: '01:15 · A second question asks, “Who was Michael Jackson?”' },
  { at: 82, text: '01:22 · The prototype replies “Information not found in context.” This is one observed out-of-topic refusal.' }
];

let records = [];
let language = 'english';
let selected = 0;

function splitRecord(item) {
  const user = item.messages.find(message => message.role === 'user')?.content || '';
  const target = item.messages.find(message => message.role === 'assistant')?.content || '';
  const at = user.lastIndexOf('\nQuestion:\n');
  const ct = user.indexOf('Context:\n');
  return {
    id: item.source_record_id,
    hash: item.context_sha256,
    question: at >= 0 ? user.slice(at + 11).trim() : '',
    context: ct >= 0 ? user.slice(ct + 9, at >= 0 ? at : undefined).trim() : '',
    target
  };
}

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function show(item) {
  selected = item.id;
  detail.replaceChildren();
  detail.className = 'corpus-detail v2-corpus-detail';
  const translated = translations[item.id];
  if (language === 'english' && translated) {
    detail.append(el('span', 'eyebrow', `SOURCE PAIR ${item.id} / ENGLISH GUIDE`), el('h3', '', translated.question));
    const answer = el('div', 'v2-case');
    answer.append(el('span', 'v2-badge', 'GENERATED TARGET · TRANSLATION'), el('p', '', translated.answer));
    const source = el('div', 'v2-case');
    source.style.marginTop = '12px';
    source.append(el('span', 'v2-badge', 'SOURCE CONTEXT · TRANSLATION SUMMARY'), el('p', '', translated.source));
    detail.append(answer, source);
    if (item.id === 12 || item.id === 13) detail.append(el('p', 'v2-small', 'Records 12 and 13 share the same source context hash. A question-level train/test split could place this passage on both sides.'));
  } else {
    detail.append(el('span', 'eyebrow', `SOURCE PAIR ${item.id} / ORIGINAL PERSIAN`));
    const q = el('h3', 'v2-rtl', item.question);
    const a = el('div', 'v2-case v2-rtl', item.target);
    const context = el('details', 'v2-context');
    context.append(el('summary', '', 'Open full retained source context'));
    context.append(el('div', 'v2-rtl passage', item.context));
    detail.append(q, a, context);
  }
  const original = el('details', 'v2-context');
  original.append(el('summary', '', language === 'english' ? 'Read original Persian question, target and full context' : 'Source identity'));
  if (language === 'english') {
    const passage = el('div', 'v2-rtl passage', `پرسش: ${item.question}\n\nپاسخ تولیدشده: ${item.target}\n\nمتن منبع:\n${item.context}`);
    passage.lang = 'fa';
    original.append(passage);
  }
  original.append(el('p', 'v2-small', `Source record ${item.id} · context SHA-256 ${item.hash}`));
  detail.append(original);
  for (const button of list.querySelectorAll('button')) button.setAttribute('aria-current', String(Number(button.dataset.record) === item.id));
}

function renderList() {
  const term = query.value.trim().toLocaleLowerCase();
  const candidates = language === 'english' ? [0, 12, 13].map(id => records.find(record => record.id === id)).filter(Boolean) : records;
  const matches = term ? candidates.filter(item => `${item.question} ${item.target}`.toLocaleLowerCase().includes(term)) : candidates;
  list.replaceChildren(...matches.slice(0, language === 'english' ? 3 : 80).map(item => {
    const button = el('button', '', language === 'english' ? translations[item.id].question : item.question);
    button.type = 'button';
    if (language === 'persian') button.lang = 'fa';
    button.dataset.record = item.id;
    button.addEventListener('click', () => show(item));
    return button;
  }));
  count.textContent = language === 'english' ? '3 translated source pairs · 912 original records' : `${matches.length} / ${records.length} original records`;
  const current = matches.find(item => item.id === selected) || matches[0];
  if (current) show(current);
  else detail.replaceChildren(el('p', '', 'No matching records.'));
}

query.addEventListener('input', renderList);
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
  language = button.dataset.language;
  document.querySelectorAll('[data-language]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  query.value = '';
  query.placeholder = language === 'english' ? 'Three translated examples' : 'جستجو در پرسش‌ها';
  query.disabled = false;
  selected = language === 'english' ? 0 : selected;
  renderList();
}));
query.disabled = false;
query.placeholder = 'Three translated examples';
fetch('media/corpus.jsonl').then(response => {
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  return response.text();
}).then(raw => {
  records = raw.trim().split(/\r?\n/).map(line => splitRecord(JSON.parse(line)));
  renderList();
}).catch(error => { count.textContent = `Corpus unavailable: ${error.message}`; });

function updateCaption() {
  const at = video.currentTime || 0;
  caption.textContent = [...captionRanges].reverse().find(item => at >= item.at)?.text || captionRanges[0].text;
}
video.addEventListener('timeupdate', updateCaption);
video.addEventListener('seeked', updateCaption);
document.querySelectorAll('[data-video-point]').forEach(button => button.addEventListener('click', () => {
  video.currentTime = Number(button.dataset.videoPoint);
  updateCaption();
  video.play().catch(() => {});
}));
updateCaption();
