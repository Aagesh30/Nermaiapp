const fs = require('fs');
const content = fs.readFileSync('App.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  if (l.includes('todayQuiz') || l.includes('lmsSub === "quiz"') || l.includes('lmsSub === "all-quizzes"') || l.includes('quizScore') || l.includes('startQuiz')) {
    console.log(`${idx + 1}: ${l.trim()}`);
  }
});
