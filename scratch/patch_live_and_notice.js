const fs = require('fs');
const filePath = 'd:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix isEnded in live session bucket categorization
const targetBucket = "                                const isEnded = sessionStatus === 'ENDED' || sessionStatus === 'CANCELLED' || sessionStatus === 'EXPIRED' || sessionStatus === 'ARCHIVED' || sessionStatus === 'ended' || isExpired;";
const replaceBucket = "                                const isEndedStatus = (s: string) => ['ENDED', 'CANCELLED', 'EXPIRED', 'ARCHIVED', 'NOT_UPLOADED', 'RECORDED_AVAILABLE', 'ended'].includes(String(s || '').toUpperCase()) || String(s || '').toLowerCase() === 'ended';\r\n                                const isEnded = isEndedStatus(sessionStatus) || isExpired;";

// 2. Fix isEnded in renderLiveClassCard
const targetCard = "                                const isEnded = sessionStatus === 'ENDED' || sessionStatus === 'CANCELLED' || sessionStatus === 'EXPIRED' || sessionStatus === 'ARCHIVED';";
const replaceCard = "                                const isEnded = ['ENDED', 'CANCELLED', 'EXPIRED', 'ARCHIVED', 'NOT_UPLOADED', 'RECORDED_AVAILABLE', 'ended'].includes(String(sessionStatus || '').toUpperCase()) || String(sessionStatus || '').toLowerCase() === 'ended' || isExpired;";

// 3. Fix Notice Board date formatting (DD/MM/YYYY)
const targetNoticeDate = "{new Date(n.publishedAt).toLocaleDateString()}";
const replaceNoticeDate = "{(() => { const d = new Date(n.publishedAt); return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })()}";

console.log('Index of targetBucket:', content.indexOf(targetBucket));
console.log('Index of targetCard:', content.indexOf(targetCard));
console.log('Index of targetNoticeDate:', content.indexOf(targetNoticeDate));

if (content.indexOf(targetBucket) !== -1) {
  content = content.replace(targetBucket, replaceBucket);
}
if (content.indexOf(targetCard) !== -1) {
  content = content.replace(targetCard, replaceCard);
}
if (content.indexOf(targetNoticeDate) !== -1) {
  content = content.replace(targetNoticeDate, replaceNoticeDate);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('App.tsx successfully patched!');
