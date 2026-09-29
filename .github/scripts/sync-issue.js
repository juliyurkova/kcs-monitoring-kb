// Синхронизация GitHub Issue -> страница в BookStack (методология KCS)
// opened  -> создаётся страница
// edited  -> страница обновляется
// closed  -> страница обновляется, статус меняется на "Закрыто"
const { marked } = require('marked');
 
const {
  BOOKSTACK_URL,
  BOOKSTACK_API_ID,
  BOOKSTACK_API_SECRET,
  BOOKSTACK_BOOK_ID,
  ISSUE_ACTION,
  ISSUE_NUMBER,
  ISSUE_TITLE,
  ISSUE_BODY,
  ISSUE_URL,
  ISSUE_STATE,
  ISSUE_LABELS,
} = process.env;
 
const base = (BOOKSTACK_URL || '').replace(/\/+$/, '');
const headers = {
  Authorization: `Token ${BOOKSTACK_API_ID}:${BOOKSTACK_API_SECRET}`,
  'Content-Type': 'application/json',
  'Bypass-Tunnel-Reminder': 'true', // чтобы localtunnel не показывал страницу с паролем
};
 
async function api(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${res.statusText}\n${text}`);
  }
  return text ? JSON.parse(text) : {};
}
 
// Ищем страницу по тегу github_issue=<номер задачи>
async function findPageId() {
  const query = encodeURIComponent(`[github_issue=${ISSUE_NUMBER}] {type:page}`);
  const result = await api('GET', `/api/search?query=${query}&count=5`);
  const hit = (result.data || []).find((item) => item.type === 'page');
  return hit ? hit.id : null;
}
 
function buildHtml() {
  const closed = ISSUE_STATE === 'closed';
  const statusText = closed ? 'Закрыто (решение подтверждено)' : 'Открыто (в работе)';
  const body = ISSUE_BODY && ISSUE_BODY.trim() ? ISSUE_BODY : 'Нет описания';
  return (
    `<p><strong>Связанная задача:</strong> <a href="${ISSUE_URL}">${ISSUE_URL}</a></p>\n` +
    `<p><strong>Статус статьи:</strong> ${statusText}</p>\n<hr>\n` +
    marked.parse(body)
  );
}
 
function buildTags() {
  const tags = [
    { name: 'github_issue', value: String(ISSUE_NUMBER) },
    { name: 'status', value: ISSUE_STATE },
  ];
  (ISSUE_LABELS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((label) => tags.push({ name: 'label', value: label }));
  return tags;
}
 
async function main() {
  console.log(`Issue #${ISSUE_NUMBER}, action: ${ISSUE_ACTION}, state: ${ISSUE_STATE}`);
  const payload = { name: ISSUE_TITLE, html: buildHtml(), tags: buildTags() };
  const pageId = await findPageId();
 
  if (pageId) {
    await api('PUT', `/api/pages/${pageId}`, payload);
    console.log(`Page ${pageId} updated`);
  } else {
    const created = await api('POST', '/api/pages', {
      ...payload,
      book_id: Number(BOOKSTACK_BOOK_ID),
    });
    console.log(`Page created, id = ${created.id}`);
  }
}
 
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
