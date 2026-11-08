/**
 * Korean card / pay-app payment notification parser (SMS or push text).
 *
 * Issuers word their alerts differently and change them without notice, so
 * instead of one template per card company this peels off every token it can
 * recognize — card name + digits, masked holder name, amount, installment,
 * date/time, running totals, status words — and treats what's left as the
 * merchant. Shared by the /api/inbox route (to answer the Shortcut) and the
 * client-side importer, so it must stay free of browser/React imports.
 */

export type CardNotice = {
  kind: 'approval' | 'cancel';
  /** Positive amount in `currency` units (KRW = whole won). */
  amount: number;
  currency: string;
  merchant: string;
  /** Canonical issuer, e.g. '신한카드'. */
  issuer?: string;
  /** Card digits as printed — may contain '*' for masked positions (NH: 1*2*). */
  last4?: string;
  /** Months; undefined = 일시불. */
  installment?: number;
  /** Transaction time printed in the text (local time). */
  date?: Date;
  overseas: boolean;
  /** Original foreign charge when the text also shows the won amount. */
  fx?: { amount: number; currency: string };
};

export type ParseResult =
  | { ok: true; notice: CardNotice }
  | { ok: false; reason: 'declined' | 'not-transaction' | 'no-amount' };

const DECLINED =
  /승인\s?거절|거절|승인\s?실패|결제\s?실패|한도\s?초과|잔액\s?부족|비밀번호\s?(?:오류|불일치)/;
const AD = /\(광고\)|\[광고\]/;
const NOT_TX =
  /결제\s?예정|청구\s?(?:금액|예정)|명세서|이용\s?대금|납부\s?(?:금액|예정|안내)|출금\s?예정|\d{1,2}월\s?(?:이용|사용|결제)\s?금액|혜택|이벤트|쿠폰/;
/** Wording only an actual payment alert uses — overrides a stray 혜택/이벤트 footer. */
const STRONG_TX = /승인|결제했|결제\s?완료|결제되었|사용했|사용하셨/;
const TRANSFER = /이체|송금|보냈어요|받았어요|입금/;
const TX_HINT = /승인|결제|사용|이용|출금|구매|지출|paid|payment|purchase/i;
const CANCEL = /취소|환불/;

const NUM = String.raw`\d{1,3}(?:,\d{3})+|\d+`;
const DEC = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?`;
const KRW_RE = new RegExp(String.raw`(?:₩|KRW)\s?(${NUM})|(${NUM})\s?(?:원|KRW)`, 'g');
const COMMA_NUM_RE = /\d{1,3}(?:,\d{3})+(?![\d.])/g;
const FX_CODE = 'USD|JPY|EUR|GBP|CNY|RMB|HKD|SGD|AUD|CAD|CHF|THB|VND|PHP|TWD|MYR|IDR|NZD';
const FX_PRE_RE = new RegExp(String.raw`(${FX_CODE}|US\$|\$|€|£|¥)\s?(${DEC})`, 'g');
const FX_POST_RE = new RegExp(String.raw`(${DEC})\s?(${FX_CODE}|달러|엔|유로|위안|파운드)`, 'g');
const FX_ALIAS: Record<string, string> = {
  US$: 'USD',
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  RMB: 'CNY',
  달러: 'USD',
  엔: 'JPY',
  유로: 'EUR',
  위안: 'CNY',
  파운드: 'GBP',
};
/** Words right before a number that make it a running total, not the charge. */
const TOTAL_CONTEXT =
  /(?:누적|잔액|잔여|한도|가능|예정|합계|포인트|적립|할인|캐시백|청구|총)\s?(?:금액)?\s?:?\s?$/;

/** Card-issuer words — only trusted when followed by 카드/체크 or card digits. */
const ISSUER_WORDS: Array<[string, string]> = [
  ['KB\\s?국민', 'KB국민카드'],
  ['국민', 'KB국민카드'],
  ['신한', '신한카드'],
  ['삼성', '삼성카드'],
  ['현대', '현대카드'],
  ['롯데', '롯데카드'],
  ['하나', '하나카드'],
  ['우리', '우리카드'],
  ['NH\\s?농협', 'NH농협카드'],
  ['NH', 'NH농협카드'],
  ['농협', 'NH농협카드'],
  ['BC', 'BC카드'],
  ['비씨', 'BC카드'],
  ['씨티', '씨티카드'],
  ['시티', '씨티카드'],
  ['IBK\\s?기업', 'IBK기업은행'],
  ['IBK', 'IBK기업은행'],
  ['SC\\s?제일', 'SC제일은행'],
  ['수협', '수협카드'],
  ['광주', '광주카드'],
  ['전북', '전북카드'],
  ['BNK\\s?경남', 'BNK경남은행'],
  ['BNK\\s?부산', 'BNK부산은행'],
  ['iM', 'iM뱅크'],
  ['DGB', 'iM뱅크'],
  ['제주', '제주카드'],
  ['우체국', '우체국'],
  ['MG\\s?새마을', 'MG새마을금고'],
  ['신협', '신협'],
  ['KB', 'KB국민카드'],
];
// Without 카드/체크 the digits must hug the word ("삼성1234", "우리(1234)") so
// "현대 2026" or "롯데마트" never reads as a card.
const ISSUER_RE = new RegExp(
  String.raw`(${ISSUER_WORDS.map(([w]) => w).join('|')})(?:(\s?(?:체크|신용)\s?(?:카드)?|\s?카드)\s?)?(?:\(\s?([\d*]{4})\s?\)|([\d*]{4})(?!\d))?`,
  'g',
);
/**
 * Names that identify the source on their own (pay apps, internet banks, card
 * apps). In a card SMS the same names show up as the *merchant* when paying
 * through that PG ("…14:23 네이버페이"), so they only count as the source when
 * no card issuer was found or when they lead the text (a push title).
 */
const BRANDS: Array<[RegExp, string]> = [
  [/카카오\s?뱅크(?![가-힣A-Za-z])/, '카카오뱅크'],
  [/토스\s?뱅크(?![가-힣A-Za-z])/, '토스뱅크'],
  [/(?:케이|K)\s?뱅크(?![가-힣A-Za-z])/, '케이뱅크'],
  [/카카오\s?페이(?![가-힣A-Za-z])/, '카카오페이'],
  [/(?:네이버\s?페이|N\s?Pay)(?![가-힣A-Za-z])/i, '네이버페이'],
  [/토스\s?페이(?![가-힣A-Za-z])/, '토스페이'],
  [/(?:페이코|PAYCO)(?![가-힣A-Za-z])/i, '페이코'],
  [/(?:애플\s?페이|Apple\s?Pay)(?![가-힣A-Za-z])/i, 'Apple Pay'],
  [/(?:삼성\s?페이|Samsung\s?Pay)(?![가-힣A-Za-z])/i, '삼성페이'],
  [/(?:신한\s?SOL\s?페이|SOL\s?페이|신한\s?SOL)(?![가-힣A-Za-z])/i, '신한카드'],
  [/KB\s?Pay(?![가-힣A-Za-z])/i, 'KB국민카드'],
  [/하나\s?(?:Pay|페이)(?![가-힣A-Za-z])/i, '하나카드'],
  [/우리\s?WON(?:\s?카드)?(?![가-힣A-Za-z])/i, '우리카드'],
  [/(?:NH\s?pay|올원\s?페이)(?![가-힣A-Za-z])/i, 'NH농협카드'],
];

const HOLDER_RE = /(^|[\s(])([가-힣][*＊][가-힣*]?|[가-힣]{2}[*＊])(\s?님)?(?=$|[\s()])/gm;
const PAREN_DIGITS_RE = /\(\s?([\d*]{4})\s?\)/;
const INSTALLMENT_RE = /\(?\s?(일시불|(\d{1,2})\s?개월(?:\s?할부)?|할부\s?(\d{1,2})\s?개월)\s?\)?/;
const DT_RE =
  /(?:(\d{4})[./-])?(\d{1,2})[./-](\d{1,2})\.?\s*(?:\([월화수목금토일]\)\s*)?(?:(오전|오후)\s?)?(\d{1,2}):(\d{2})(?::\d{2})?/;
const DT_KO_RE =
  /(\d{1,2})월\s?(\d{1,2})일\s*(?:\([월화수목금토일]\)\s*)?(?:(오전|오후)\s?)?(\d{1,2})[:시]\s?(\d{2})분?/;
const TIME_RE = /(?:(오전|오후)\s?)?(\d{1,2}):(\d{2})(?::\d{2})?/;

const STOP_TOKEN = new RegExp(
  [
    '^(?:',
    '(?:해외|국내|국외|체크|신용)?(?:승인|결제|사용|이용|매출|구매)(?:취소|완료|승인|알림|내역|금액|일시)?',
    '|취소(?:승인|완료)?|환불|완료|일시불|할부|누적|총누적|잔액|체크카드|신용카드|체크|신용|카드',
    '|국내|해외|국외|일반|님|원|출금|지출|알림|안내|금액|가맹점|가맹점명|사용처|결제처|일시|거래|내역',
    '|결제(?:했어요|했습니다|되었습니다|됐어요)|사용(?:했어요|하셨습니다|되었습니다)',
    '|승인(?:되었습니다|됐어요)|[을를이가은는의에]',
    ')$',
  ].join(''),
  'i',
);
/** Leftover lines that read like a sentence or footer, never a store name. */
const NON_MERCHANT =
  /(?:하기|보기|하세요|세요|해요|어요|아요|니다|확인|바로가기|자세히)$|혜택|이벤트|포인트|적립|쿠폰|안내|문의|고객센터|www\.|https?:/;

const MARK_TIME = '\u0001';
const MARK_AMOUNT = '\u0002';

type Span = { start: number; end: number; mark?: string };

function normalize(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/\[(?:Web발신|웹발신|국외발신|국제발신|해외발신)\]/gi, '\n')
    .replace(/[ \t ]+/g, ' ')
    .trim();
}

function toNumber(s: string): number {
  return Number(s.replace(/,/g, ''));
}

/** Replace spans with line breaks (or a marker line) so the leftovers split apart. */
function blank(s: string, spans: Span[]): string {
  const sorted = [...spans].sort((a, b) => b.start - a.start);
  let out = s;
  let lastStart = Number.POSITIVE_INFINITY;
  for (const sp of sorted) {
    if (sp.end > lastStart) continue; // overlaps a later span that already won
    out = `${out.slice(0, sp.start)}${sp.mark ? `\n${sp.mark}\n` : '\n'}${out.slice(sp.end)}`;
    lastStart = sp.start;
  }
  return out;
}

function resolveDate(
  p: { year?: number; month?: number; day?: number; ampm?: string; hour: number; minute: number },
  now: Date,
): Date | undefined {
  let h = p.hour;
  if (p.ampm === '오후' && h < 12) h += 12;
  if (p.ampm === '오전' && h === 12) h = 0;
  if (h > 23 || p.minute > 59) return undefined;
  if (p.month !== undefined && p.day !== undefined) {
    if (p.month < 1 || p.month > 12 || p.day < 1 || p.day > 31) return undefined;
    const y = p.year ?? now.getFullYear();
    let d = new Date(y, p.month - 1, p.day, h, p.minute);
    // "12/31 23:50" read on Jan 1 belongs to last year.
    if (p.year === undefined && d.getTime() - now.getTime() > 2 * 86_400_000) {
      d = new Date(y - 1, p.month - 1, p.day, h, p.minute);
    }
    return d;
  }
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, p.minute);
  // Time-only "23:58" read just after midnight → yesterday.
  if (d.getTime() - now.getTime() > 10 * 60_000) return new Date(d.getTime() - 86_400_000);
  return d;
}

function findDate(s: string, now: Date): { date: Date; start: number; end: number } | null {
  const dt = s.match(DT_RE);
  if (dt?.index !== undefined) {
    const date = resolveDate(
      {
        year: dt[1] ? Number(dt[1]) : undefined,
        month: Number(dt[2]),
        day: Number(dt[3]),
        ampm: dt[4],
        hour: Number(dt[5]),
        minute: Number(dt[6]),
      },
      now,
    );
    if (date) return { date, start: dt.index, end: dt.index + dt[0].length };
  }
  const ko = s.match(DT_KO_RE);
  if (ko?.index !== undefined) {
    const date = resolveDate(
      {
        month: Number(ko[1]),
        day: Number(ko[2]),
        ampm: ko[3],
        hour: Number(ko[4]),
        minute: Number(ko[5]),
      },
      now,
    );
    if (date) return { date, start: ko.index, end: ko.index + ko[0].length };
  }
  const tm = s.match(TIME_RE);
  if (tm?.index !== undefined) {
    const date = resolveDate({ ampm: tm[1], hour: Number(tm[2]), minute: Number(tm[3]) }, now);
    if (date) return { date, start: tm.index, end: tm.index + tm[0].length };
  }
  return null;
}

function cleanSegment(seg: string): string {
  const tokens = seg
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t && !STOP_TOKEN.test(t.replace(/[:：]$/, '').replace(/^[[(]|[\])]$/g, '')));
  return tokens
    .join(' ')
    .replace(/^(?:\(주\)|㈜|주식회사)\s?/, '')
    .replace(/\s?(?:\(주\)|㈜)$/, '')
    .replace(/(?:에서의|에서)$/, '')
    .replace(/^[\s\-–—:·•|/[\](){}<>]+|[\s\-–—:·•|/[\](){}<>]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isMerchantLike(s: string): boolean {
  return (
    /[가-힣A-Za-z]/.test(s) &&
    s.replace(/[^가-힣A-Za-z0-9]/g, '').length >= 2 &&
    !NON_MERCHANT.test(s)
  );
}

export function parseCardNotification(raw: string, now: Date = new Date()): ParseResult {
  const s = normalize(raw);
  if (!s) return { ok: false, reason: 'no-amount' };
  if (DECLINED.test(s)) return { ok: false, reason: 'declined' };
  if (AD.test(s) || (NOT_TX.test(s) && !STRONG_TX.test(s))) {
    return { ok: false, reason: 'not-transaction' };
  }
  if (TRANSFER.test(s) && !/승인|결제|사용/.test(s))
    return { ok: false, reason: 'not-transaction' };

  const spans: Span[] = [];

  // ── Amounts: the charge gets a marker; running totals are only blanked ──
  let krw: number | undefined;
  for (const m of s.matchAll(KRW_RE)) {
    const idx = m.index ?? 0;
    const ctx = s.slice(Math.max(0, idx - 10), idx).match(TOTAL_CONTEXT);
    if (ctx) {
      spans.push({ start: idx - ctx[0].length, end: idx + m[0].length });
      continue;
    }
    if (krw === undefined) {
      krw = toNumber(m[1] ?? m[2]);
      spans.push({ start: idx, end: idx + m[0].length, mark: MARK_AMOUNT });
    } else {
      spans.push({ start: idx, end: idx + m[0].length });
    }
  }
  let fx: { amount: number; currency: string } | undefined;
  for (const re of [FX_PRE_RE, FX_POST_RE]) {
    for (const m of s.matchAll(re)) {
      const idx = m.index ?? 0;
      if (TOTAL_CONTEXT.test(s.slice(Math.max(0, idx - 10), idx))) continue;
      const [code, value] = re === FX_PRE_RE ? [m[1], m[2]] : [m[2], m[1]];
      const first = !fx;
      if (first) fx = { amount: toNumber(value), currency: FX_ALIAS[code] ?? code.toUpperCase() };
      spans.push({
        start: idx,
        end: idx + m[0].length,
        mark: first && krw === undefined ? MARK_AMOUNT : undefined,
      });
    }
  }
  if (krw === undefined && !fx) {
    // Bank-style alerts print "출금 12,500" without 원.
    for (const m of s.matchAll(COMMA_NUM_RE)) {
      const idx = m.index ?? 0;
      const ctx = s.slice(Math.max(0, idx - 10), idx).match(TOTAL_CONTEXT);
      if (ctx) {
        spans.push({ start: idx - ctx[0].length, end: idx + m[0].length });
        continue;
      }
      const first = krw === undefined;
      if (first) krw = toNumber(m[0]);
      spans.push({ start: idx, end: idx + m[0].length, mark: first ? MARK_AMOUNT : undefined });
    }
  }
  if ((krw === undefined || krw <= 0) && (!fx || fx.amount <= 0)) {
    return { ok: false, reason: 'no-amount' };
  }

  // ── Issuer + card digits ──
  let issuer: string | undefined;
  let last4: string | undefined;
  for (const m of s.matchAll(ISSUER_RE)) {
    const [, word, cardWord, pDigits, bareDigits] = m;
    const digits = pDigits ?? bareDigits;
    if (!cardWord && !digits) continue; // "삼성서울병원", "롯데마트" …
    const idx = m.index ?? 0;
    const prev = s[idx - 1];
    if (prev && /[A-Za-z가-힣]/.test(prev)) continue; // must start a word
    issuer = ISSUER_WORDS.find(([w]) => new RegExp(`^${w}$`).test(word))?.[1];
    if (digits) last4 = digits;
    spans.push({ start: idx, end: idx + m[0].length });
    break;
  }
  const cardIssuer = issuer !== undefined;
  for (const [re, name] of BRANDS) {
    const m = s.match(re);
    if (m?.index === undefined || (cardIssuer && m.index > 2)) continue;
    if (!cardIssuer) issuer ??= name;
    spans.push({ start: m.index, end: m.index + m[0].length });
  }
  if (!last4) {
    const m = s.match(PAREN_DIGITS_RE) ?? s.match(/(?:승인|취소)\s?([\d*]{4})(?!\d)/);
    if (m?.index !== undefined) {
      last4 = m[1];
      const offset = m[0].indexOf(m[1]);
      spans.push({
        start: m.index + (m[0].startsWith('(') ? 0 : offset),
        end: m.index + m[0].length,
      });
    }
  }

  // ── Masked holder name, installment ──
  for (const m of s.matchAll(HOLDER_RE)) {
    const idx = (m.index ?? 0) + m[1].length;
    spans.push({ start: idx, end: idx + m[2].length + (m[3]?.length ?? 0) });
  }
  let installment: number | undefined;
  const inst = s.match(INSTALLMENT_RE);
  if (inst?.index !== undefined) {
    const months = Number(inst[2] ?? inst[3] ?? 0);
    if (months > 1) installment = months;
    spans.push({ start: inst.index, end: inst.index + inst[0].length });
  }

  // ── Date / time — its position also anchors the merchant search ──
  const when = findDate(s, now);
  if (when) spans.push({ start: when.start, end: when.end, mark: MARK_TIME });

  // ── Merchant: whatever survived. With a timestamp (SMS formats) it's the
  //    first piece after it; otherwise (push formats) the piece nearest the
  //    amount, ties going to the one after it. ──
  const cands: Array<{ text: string; idx: number }> = [];
  let idx = 0;
  let timeIdx = -1;
  let amountIdx = -1;
  for (const line of blank(s, spans).split('\n')) {
    if (line === MARK_TIME) {
      timeIdx = idx++;
      continue;
    }
    if (line === MARK_AMOUNT) {
      amountIdx = idx++;
      continue;
    }
    for (const piece of line.split(/\s*[|·,]\s*|\s+[-–—]\s+/)) {
      const cleaned = cleanSegment(piece);
      if (isMerchantLike(cleaned)) cands.push({ text: cleaned.slice(0, 40), idx });
      idx++;
    }
  }
  let picked: string | undefined;
  if (timeIdx >= 0) {
    picked =
      cands.find((c) => c.idx > timeIdx)?.text ?? cands.filter((c) => c.idx < timeIdx).pop()?.text;
  } else {
    const anchor = amountIdx >= 0 ? amountIdx : idx;
    let best = Number.POSITIVE_INFINITY;
    for (const c of cands) {
      const d = Math.abs(c.idx - anchor) + (c.idx < anchor ? 0.5 : 0);
      if (d < best) {
        best = d;
        picked = c.text;
      }
    }
  }
  const merchant = picked ?? (issuer ? `${issuer} 결제` : '카드 결제');

  const hinted = TX_HINT.test(s) || issuer !== undefined || /₩|KRW/.test(s) || fx !== undefined;
  if (!hinted) return { ok: false, reason: 'not-transaction' };

  const useKrw = krw !== undefined && krw > 0;
  return {
    ok: true,
    notice: {
      kind: CANCEL.test(s) ? 'cancel' : 'approval',
      amount: useKrw ? (krw as number) : (fx as { amount: number }).amount,
      currency: useKrw ? 'KRW' : (fx as { currency: string }).currency,
      merchant,
      issuer,
      last4,
      installment,
      date: when?.date,
      overseas: fx !== undefined || /해외|국외/.test(s),
      fx: useKrw ? fx : undefined,
    },
  };
}

/** "12,500원 · GS25 역삼점" — used in the Shortcut reply and the import log. */
export function noticeSummary(n: CardNotice): string {
  const amount =
    n.currency === 'KRW'
      ? `${n.amount.toLocaleString('ko-KR')}원`
      : `${n.currency} ${n.amount.toLocaleString('en-US', {
          minimumFractionDigits: Number.isInteger(n.amount) ? 0 : 2,
          maximumFractionDigits: 2,
        })}`;
  return `${n.kind === 'cancel' ? '취소 ' : ''}${amount} · ${n.merchant}`;
}
