# 가계부 (Asset)

Toss 스타일 모바일 가계부 PWA. 개인/사업자 모드 토글로 한 앱에서 둘 다 관리.

## 주요 기능

- **개인/사업자 모드 토글** — 홈 상단 알약. 거래·카테고리·KPI가 모두 모드별로 분리됨
- **거래 입력** — 커스텀 키패드, 빠른 금액 추가, 카테고리/계좌 선택, 메모
- **거래 상세** — 메모 인라인 편집, 삭제 확인
- **내역** — 월별 네비, 일자별 그룹핑, 가게/메모 검색, 지출/수입 필터
- **통계** — 카테고리별 도넛, Top 5 가게
- **예산** (개인) — 카테고리 한도와 진행률
- **고정비 분석** (사업) — 비용 카테고리 자동 집계
- **저축 목표** (개인) — 목표 진행률 + D-day
- **자산** — 은행/카드 계좌 카드, 순자산 표시
- **설정** — 다크 모드, JSON 백업·복원, 데이터 초기화
- **PWA** — manifest + 동적 아이콘. 폰 홈화면에 설치 가능

## 사업자 모드의 차별점

- 매출 / 비용 / 영업이익 KPI
- **부가세 예상액** 자동 계산 (매출의 1/11)
- 사업 전용 카테고리: 매입·재료, 임대료, 인건비, 공과금, 마케팅, 출장, 보험, 세금, 수수료 등
- 매출 채널 분리: 카드 매출, 현금 매출, 계좌 매출, 배달앱 매출

## 기술 스택

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** (CSS `@theme` 변수 기반 디자인 토큰)
- **localStorage** 클라이언트 사이드 저장 (Phase 1)
- **Vercel** 배포

## 폴더 구조

```
src/
├─ app/
│  ├─ layout.tsx          # 루트 + Provider 스택
│  ├─ page.tsx            # 홈 (개인/사업 분기)
│  ├─ add/                # 거래 추가
│  ├─ tx/[id]/            # 거래 상세
│  ├─ list/               # 내역
│  ├─ stats/              # 통계
│  ├─ wallet/             # 자산
│  ├─ budget/             # 예산 / 고정비 분석
│  ├─ goals/              # 저축 목표
│  ├─ settings/           # 설정
│  ├─ manifest.ts         # PWA 매니페스트
│  └─ icon.tsx            # 동적 앱 아이콘
├─ components/
│  ├─ AppShell.tsx        # 모바일 컨테이너 + 바텀 네비
│  ├─ BottomNav.tsx
│  ├─ TopBar.tsx
│  ├─ ModeProvider.tsx    # 개인/사업 모드 컨텍스트
│  ├─ ModeToggle.tsx
│  ├─ ThemeProvider.tsx   # 다크 모드
│  ├─ Toast.tsx
│  ├─ Keypad.tsx
│  ├─ TxRow.tsx
│  ├─ CategoryDonut.tsx
│  ├─ UpcomingRecurring.tsx
│  └─ InstallHint.tsx
└─ lib/
   ├─ types.ts
   ├─ categories.ts       # 개인 21 + 사업 17 카테고리
   ├─ seed.ts             # 시드 거래·계좌·예산·목표
   ├─ format.ts           # ₩ 포맷터
   ├─ storage.ts          # 거래 hook (localStorage + 모드 필터)
   └─ backup.ts           # JSON 내보내기/가져오기
```

## 로컬 개발

```bash
npm install
npm run dev        # http://localhost:3000
```

폰에서 미리보기: 같은 Wi-Fi에서 `http://<PC IP>:3000` 접속.

## 빌드 / 배포

```bash
npm run build      # 프로덕션 빌드
npm start          # 빌드 결과 로컬 실행
```

Vercel: `web/` 폴더를 Vercel 프로젝트로 연결하면 자동 배포.

## 데이터 안전성

모든 거래는 브라우저 **localStorage**에 저장됨. 캐시 삭제 시 사라지므로 **설정 → 백업 내보내기**로 정기 백업 권장.

향후 Phase 2에서 Supabase 등 클라우드 동기화 추가 예정.
