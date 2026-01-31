// 한글 초성 배열
const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

const UNICODE_KOREAN_START = 0xAC00; // '가'
const UNICODE_KOREAN_END = 0xD7A3;   // '힣'
const CHOSUNG_UNIT = 588;             // 각 초성마다 588개의 글자

/**
 * 한글 문자열에서 초성만 추출
 */
export function extractChosung(text: string): string {
  let chosung = '';
  
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    
    // 한글 유니코드 범위 확인
    if (code >= UNICODE_KOREAN_START && code <= UNICODE_KOREAN_END) {
      const chosungIndex = Math.floor((code - UNICODE_KOREAN_START) / CHOSUNG_UNIT);
      chosung += CHOSUNG_LIST[chosungIndex];
    } else {
      // 한글이 아닌 경우 그대로 추가
      chosung += text[i];
    }
  }
  
  return chosung;
}

/**
 * 검색어와 대상 텍스트가 매칭되는지 확인 (초성 검색 지원)
 */
export function matchesKoreanSearch(target: string, query: string): boolean {
  if (!query) return true;
  
  const normalizedTarget = target.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  
  // 일반 문자열 매칭
  if (normalizedTarget.includes(normalizedQuery)) {
    return true;
  }
  
  // 초성 매칭
  const targetChosung = extractChosung(target);
  const queryChosung = extractChosung(query);
  
  return targetChosung.includes(queryChosung);
}
