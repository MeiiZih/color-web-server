export const colors = [
  { key: 'red', name: '紅', en: 'Red', title: '熱情的行動者', word: '熱情', ink: '#ad4252', light: '#f5d9d8', fill: '#df7280', description: '紅色代表活力、熱情和行動力。喜歡直接面對挑戰，追求立即的成果。' },
  { key: 'yellow', name: '黃', en: 'Yellow', title: '活力的探險家', word: '靈感', ink: '#796016', light: '#f8ebc4', fill: '#edc96c', description: '黃色代表陽光、樂觀與能量。喜歡自由和變化，靈活的適應能力和享受當下的態度。' },
  { key: 'green', name: '綠', en: 'Green', title: '穩健的守護者', word: '平衡', ink: '#42614c', light: '#e2ebdd', fill: '#89aa8c', description: '綠色象徵和諧、平衡與成長。重視傳統和秩序，具有可靠、負責和務實的態度。' },
  { key: 'blue', name: '藍', en: 'Blue', title: '神秘的理想主義者', word: '洞察', ink: '#3c5e7d', light: '#dde9f2', fill: '#8bb1d1', description: '藍象徵深邃冷靜，洞察力與內在智慧。具有強大的共感能力和遠見卓識。' }
];

// Match the existing color-test-new.html scoring contract, including J/P.
// The Word source has conflicting J/P annotations; resolve separately from UI review.
export function scoreAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== 20 || !Array.from(answers).every(a => Number.isInteger(a) && a >= 0 && a < 4)) {
    throw new Error('請完成全部 20 題');
  }
  const counts = [0, 0, 0, 0];
  const dimensions = [0, 0, 0, 0];
  answers.forEach((answer, index) => {
    counts[answer] += 1;
    if (answer < 2) dimensions[Math.floor(index / 5)] += 1;
  });
  const mbti = dimensions.map((value, index) => (value > 2 ? ['E', 'N', 'F', 'J'] : ['I', 'S', 'T', 'P'])[index]).join('');
  const primary = counts.indexOf(Math.max(...counts));
  const secondaryCounts = [...counts];
  secondaryCounts[primary] = 0;
  const secondary = secondaryCounts.indexOf(Math.max(...secondaryCounts));
  return { counts, mbti, primary, secondary };
}

export function validSurveyAnswers(survey, answers, complete = false) {
  return Array.isArray(answers) && answers.length === survey.questions.length
    && Array.from(answers).every((answer, index) => (!complete && answer === null)
      || (Number.isInteger(answer) && answer >= 0 && answer < survey.questions[index].options.length));
}

export function finishSurvey(survey, answers) {
  if (!validSurveyAnswers(survey, answers, true)) throw new Error('請完成這份問卷的所有題目');
  if (survey.resultType === 'color-mbti') return scoreAnswers(answers);
  if (survey.resultType === 'receipt') return { completed: answers.length };
  throw new Error('這份問卷尚未設定結果規則');
}
