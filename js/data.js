// 기획안 v14 기준 콘텐츠
window.DATA = (function () {
  const FRAG = {
    silence: '나는 마음이 온유하고',
    main: '겸손하니',
    hundred: '나의 멍에를 메고',
    secret: '내게 배우라',
    quiz: '그리하면',
    oyat: '너희 마음이 쉼을 얻으리니',
  };
  // 마 11:29 순서
  const VERSE_ORDER = ['silence', 'main', 'hundred', 'secret', 'quiz', 'oyat'];

  const STAGES = {
    silence: {
      id: 'silence', place: '신학관', name: '침묵 정렬', icon: '🤫', minutes: 9,
      brief: '말·글·휴대폰·손가락 숫자 없이, 눈빛과 몸짓만으로 키워드 순서대로 한 줄로 서 보세요.',
    },
    secret: {
      id: 'secret', place: '신학관', name: '나만 모르는 미션', icon: '🙈', minutes: 9,
      brief: '스태프가 뽑기로 정해 준 미션을 해 보세요. 한 명은 미션을 모르고, 나머지 조원은 박수와 소리 크기로만 그 사람을 이끌어 줍니다.',
    },
    quiz: {
      id: 'quiz', place: '신학관', name: '말씀 퀴즈', icon: '📖', minutes: 9,
      brief: '마가복음 6:30~44 본문에서 나온 퀴즈 3문제입니다.',
    },
    hundred: {
      id: 'hundred', place: '100주년기념관', name: 'QR 말씀 찾기', icon: '🔍', minutes: 7,
      brief: '곳곳에 숨은 QR을 찾아 단어를 모으고, 살전 5:16~17 순서대로 맞춰 보세요. 함정 QR이 섞여 있어요.',
    },
    oyat: {
      id: 'oyat', place: '오얏봉', name: '오늘의 한 줄 기도', icon: '🙏', minutes: 7,
      brief: '각자 휴대폰으로 오늘의 한 줄 기도를 적습니다. 근처 어디서든 괜찮아요. 오늘은 공개하지 않고 저장만 합니다.',
    },
    main: {
      id: 'main', place: '삼육대학교회 본당', name: '이야기 카드 맞추기', icon: '🧩', minutes: 12,
      brief: '본당에 숨은 QR 6개에서 이야기 카드를 찾아 읽고, 성경에 나온 순서대로 맞춰 보세요.',
    },
    youth: {
      id: 'youth', place: '청년관', name: '쉼의 자리', icon: '☕', minutes: 14,
      brief: '도착! 따뜻한 차를 마시며 쉬고, 모은 말씀 조각으로 마태복음 11:29를 완성하세요.',
    },
  };

  const TARGETS = {
    silence: '18:10', hundred: '18:39', oyat: '18:49', main: '19:02', youth: '19:16',
  };

  // 신학관 시작 순서(조별)
  const THEO_ORDER = {
    1: ['silence', 'secret', 'quiz'], 2: ['silence', 'secret', 'quiz'],
    3: ['secret', 'quiz', 'silence'], 4: ['secret', 'quiz', 'silence'],
    5: ['quiz', 'silence', 'secret'], 6: ['quiz', 'silence', 'secret'],
  };
  const TAIL = ['hundred', 'oyat', 'main', 'youth'];

  const KEYWORDS = [
    '생일 (월·일 빠른 순)',
    '형제·자매 수 (많은 순)',
    '삼육대에서 집이 먼 순',
    '오늘 일어난 시각 (이른 순)',
    '신발 사이즈 (작은 순)',
    '지금 휴대폰 배터리 % (높은 순)',
    '교회 다닌 햇수 (오래된 순)',
    '이름 가나다 순 (또는 성의 가나다 순)',
  ];

  const QUIZ = [
    { q: '예수님이 제자들에게 "함께 가서 잠깐 쉬어라" 하시며 데려가신 곳은?', a: ['한적한 곳', '회당', '예루살렘 성전', '산꼭대기 집'], c: 0 },
    { q: '그곳에서 제자들이 가지고 있던 음식은?', a: ['빵 열두 개', '떡 다섯 개와 물고기 두 마리', '포도와 무화과', '보리떡 일곱 개'], c: 1 },
    { q: '먹고 남은 조각을 거둔 바구니는 몇 개?', a: ['일곱', '다섯', '열둘', '스물'], c: 2 },
  ];

  // QR 말씀 찾기 (살전 5:16~17)
  const WORDS = {
    h3: { t: '항상', ok: true }, h1: { t: '기뻐하라', ok: true }, h5: { t: '쉬지', ok: true },
    h8: { t: '말고', ok: true }, h7: { t: '기도하라', ok: true },
    h2: { t: '범사에', ok: false }, h6: { t: '감사하라', ok: false }, h4: { t: '때때로', ok: false },
  };
  const WORD_ANSWER = ['항상', '기뻐하라', '쉬지', '말고', '기도하라'];

  // 이야기 카드 (막 6:30~44, 정답 순서 1→6)
  const STORY = {
    q3: { n: 1, mark: '◆', t: '선교를 마치고 돌아온 제자들이 예수님께 모여, 자신들이 하고 가르친 일을 모두 이야기했습니다.' },
    q6: { n: 2, mark: '★', t: '예수님이 "너희는 따로 한적한 곳에 가서 잠깐 쉬어라" 하시고, 제자들과 함께 배를 타고 떠나셨습니다.' },
    q1: { n: 3, mark: '●', t: '그런데 사람들이 먼저 달려와 기다리고 있었습니다. 예수님은 목자 없는 양 같은 그들을 불쌍히 여기고 가르치셨습니다.' },
    q5: { n: 4, mark: '▲', t: '날이 저물자 제자들이 "사람들을 보내자"고 했지만, 예수님은 "너희가 먹을 것을 주라" 하셨습니다.' },
    q2: { n: 5, mark: '■', t: '떡 다섯 개와 물고기 두 마리를 가지고 예수님이 하늘을 우러러 감사기도 하시고, 떼어 제자들에게 나누어 주게 하셨습니다.' },
    q4: { n: 6, mark: '✚', t: '모두 배불리 먹었고, 남은 조각을 거두니 열두 바구니에 가득 찼습니다. 먹은 사람은 오천 명이었습니다.' },
  };

  return { FRAG, VERSE_ORDER, STAGES, TARGETS, THEO_ORDER, TAIL, KEYWORDS, QUIZ, WORDS, WORD_ANSWER, STORY };
})();
