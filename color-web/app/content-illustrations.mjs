// Each illustration belongs to one source article. Never reuse a topic-wide image.
const illustrations = Object.freeze({
  'gov.tw/News_Content_26_826198': 'care-guide',
  'twtcpa.org.tw/column': 'psychology-columns',
  'twtcpa.org.tw/lecture/public': 'public-lectures',
  'nature.com/articles/s41562-026-02415-6': 'digital-research',
  '1980.org.tw/course_show.php?course_id=660': 'inner-child',
  'tpa-tw.org/news': 'psychology-knowledge',
  'life1995.org.tw/?aid=301&iid=169&page_name=detail': 'youth-text',
  'dep.mohw.gov.tw/DOMHAOH/fp-4906-54077-107.html': 'hotline-1925',
  'life1995.org.tw/?aid=2&iid=2': 'lifeline-1995',
  '1980.org.tw/service_item_show.php?service_item_id=1': 'teacher-1980',
  '1980.org.tw/news_show.php?news_id=830': 'healthy-boundaries',
  '1980.org.tw/news_show.php?news_id=832': 'relationship-pause',
  'tpa-tw.org/2026submission-registration': 'social-emotional-ai',
  'mohw.gov.tw/cp-16-85046-1.html': 'counseling'
});

export function canonicalContentKey(link) {
  try {
    const url = new URL(link);
    if (!/^https?:$/.test(url.protocol)) return '';
    for (const name of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(name) || ['fbclid', 'gclid'].includes(name)) url.searchParams.delete(name);
    }
    url.searchParams.sort();
    return url.hostname.replace(/^www\./, '') + (url.pathname.replace(/\/$/, '') || '/') + url.search;
  } catch { return ''; }
}

export function dedicatedIllustrationFor(link) {
  const slug = illustrations[canonicalContentKey(link)];
  return slug ? `/assets/images/posts/${slug}-20260906.webp` : '';
}
