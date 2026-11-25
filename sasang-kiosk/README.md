# 사상체질 형상분석 키오스크

카메라가 달린 세로형(1080×1920) 터치 키오스크용 사상체질·형상의학 분석 웹앱.

## 흐름
대기화면 → 동의 → 기본정보(성별·나이·키·몸무게/BMI) → 안면 형상 촬영(478 랜드마크) → 체질 설문 18문항 → 분석 → 결과 리포트

## 분석 방식
- **안면 형상**: MediaPipe Face Landmarker(기기 내 실행). 안면 종횡비, 이마/턱 폭, 눈·코·입·입술 비율, 삼정(三停), 좌우 대칭, 볼 면색(五色) 측정 → 오행형 얼굴 분류, 체질별 가중치
- **설문**: 체형·성정·소화·한열·생활 문항 → 체질 점수 + 한열/내외향/소화력/땀 성향
- **체격**: BMI
- 최종: 설문 55% · 안면 30% · 체격 15% 가중 혼합 + 체질 유병률 사전확률 → 확률 분포, 장부 대소(폐·비·간·신) 레이더
- 가중치/기준값: `src/lib/scoring.ts`, `src/lib/face.ts`(METRIC_INFO) 에서 조정

## 실행
```bash
npm install
npm run dev       # 개발
npm run build && npm run preview   # 배포본 확인
```
모델(`public/models`)과 WASM(`public/wasm`)이 포함되어 있어 **오프라인 동작**합니다.
카메라 권한 때문에 `localhost` 또는 HTTPS 에서 띄워야 합니다.

## 키오스크 설정 (Chrome)
```bash
chrome --kiosk --app=http://localhost:4173 \
  --use-fake-ui-for-media-stream \
  --disable-pinch --overscroll-history-navigation=0 --noerrdialogs --disable-translate
```
- `?mirror=0` : 카메라 좌우 반전 끄기
- 무입력 75초 → 경고 15초 → 초기화, 결과 화면은 150초 후 자동 종료
- 영상/결과는 저장·전송하지 않음

> 본 결과는 참고용 건강 정보이며 의학적 진단을 대체하지 않습니다.
