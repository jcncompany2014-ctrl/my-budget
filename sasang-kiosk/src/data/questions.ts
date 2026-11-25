import type { TypeKey } from './constitutions'

export type Dim = 'heat' | 'extro' | 'digest' | 'sweat'

export interface Option {
  label: string
  sub?: string
  score: Partial<Record<TypeKey, number>>
  dim?: Partial<Record<Dim, number>>
}

export interface Question {
  id: string
  category: string
  categoryHanja: string
  text: string
  options: Option[]
}

export const QUESTIONS: Question[] = [
  {
    id: 'build',
    category: '체형',
    categoryHanja: '體形',
    text: '평소 자신의 체형과 가장 가까운 것은?',
    options: [
      { label: '머리·목덜미가 발달, 허리 아래는 가벼움', score: { taeyang: 3 } },
      { label: '골격이 크고 허리가 굵으며 체격이 건실함', score: { taeeum: 3 } },
      { label: '가슴·어깨가 발달, 엉덩이는 작은 편', score: { soyang: 3 } },
      { label: '체구가 아담하고 엉덩이·하체가 발달', score: { soeum: 3 } },
    ],
  },
  {
    id: 'gait',
    category: '체형',
    categoryHanja: '體形',
    text: '걸음걸이는 어떤 편인가요?',
    options: [
      { label: '성큼성큼 당당하게 걷는다', score: { taeyang: 2, taeeum: 1 } },
      { label: '느긋하고 묵직하게 걷는다', score: { taeeum: 2 } },
      { label: '빠르고 가볍게, 몸이 앞으로 쏠린다', score: { soyang: 2 } },
      { label: '조용하고 단정하게 걷는다', score: { soeum: 2 } },
    ],
  },
  {
    id: 'voice',
    category: '체형',
    categoryHanja: '體形',
    text: '목소리의 특징은?',
    options: [
      { label: '맑고 크며 멀리 울린다', score: { taeyang: 2 } },
      { label: '굵고 낮으며 무게감이 있다', score: { taeeum: 2 } },
      { label: '빠르고 높으며 말이 많은 편', score: { soyang: 2 }, dim: { extro: 1 } },
      { label: '작고 부드러우며 차분하다', score: { soeum: 2 }, dim: { extro: -1 } },
    ],
  },
  {
    id: 'first',
    category: '성정',
    categoryHanja: '性情',
    text: '처음 만나는 사람들 사이에서 나는?',
    options: [
      { label: '자연스럽게 대화를 주도한다', score: { taeyang: 2, soyang: 1 }, dim: { extro: 2 } },
      { label: '신중히 지켜보다 천천히 가까워진다', score: { taeeum: 2 }, dim: { extro: -1 } },
      { label: '금방 친해지고 분위기를 띄운다', score: { soyang: 2 }, dim: { extro: 2 } },
      { label: '조심스럽고 소수와 깊게 사귄다', score: { soeum: 2 }, dim: { extro: -2 } },
    ],
  },
  {
    id: 'work',
    category: '성정',
    categoryHanja: '性情',
    text: '일을 처리하는 방식은?',
    options: [
      { label: '큰 그림을 그리고 새 일을 밀어붙인다', score: { taeyang: 2 } },
      { label: '한번 시작하면 꾸준히 끝까지 한다', score: { taeeum: 2 } },
      { label: '빠르게 시작하지만 마무리가 아쉽다', score: { soyang: 2 } },
      { label: '계획을 세우고 꼼꼼하게 처리한다', score: { soeum: 2 } },
    ],
  },
  {
    id: 'mind',
    category: '성정',
    categoryHanja: '性情',
    text: '마음이 흔들릴 때 가장 가까운 상태는?',
    options: [
      { label: '마음이 급해지고 조급해진다', sub: '急迫之心', score: { taeyang: 3 } },
      { label: '일이 잘못될까 두려워 서두른다', sub: '懼心', score: { soyang: 3 } },
      { label: '변화가 겁나 결정을 미룬다', sub: '怯心', score: { taeeum: 3 } },
      { label: '마음이 불안하고 안정되지 않는다', sub: '不安定之心', score: { soeum: 3 } },
    ],
  },
  {
    id: 'stress',
    category: '성정',
    categoryHanja: '性情',
    text: '스트레스를 받으면 주로?',
    options: [
      { label: '화가 치밀어 참기 어렵다', score: { taeyang: 2, soyang: 1 }, dim: { heat: 1 } },
      { label: '먹는 것으로 풀거나 늘어진다', score: { taeeum: 2 } },
      { label: '욱하지만 금방 털어낸다', score: { soyang: 2 }, dim: { heat: 1 } },
      { label: '속으로 삭이며 오래 생각한다', score: { soeum: 2 }, dim: { extro: -1 } },
    ],
  },
  {
    id: 'appetite',
    category: '소화',
    categoryHanja: '消化',
    text: '식욕과 식사량은 어떤가요?',
    options: [
      { label: '식욕이 왕성하고 양이 많다', score: { taeeum: 2 }, dim: { digest: 2 } },
      { label: '식욕이 좋고 빨리 먹는다', score: { soyang: 2 }, dim: { digest: 1 } },
      { label: '조금만 먹어도 배가 부르다', score: { soeum: 2 }, dim: { digest: -2 } },
      { label: '담백한 것을 즐기고 육식은 부담된다', score: { taeyang: 2 } },
    ],
  },
  {
    id: 'digest',
    category: '소화',
    categoryHanja: '消化',
    text: '평소 소화 상태는?',
    options: [
      { label: '웬만해서는 소화에 문제가 없다', score: { taeeum: 2, soyang: 1 }, dim: { digest: 2 } },
      { label: '소화는 잘되나 속쓰림·열감이 있다', score: { soyang: 2 }, dim: { digest: 1, heat: 1 } },
      { label: '자주 체하고 더부룩하다', score: { soeum: 3 }, dim: { digest: -2 } },
      { label: '기름진 음식을 먹으면 불편하다', score: { taeyang: 2 }, dim: { digest: -1 } },
    ],
  },
  {
    id: 'stool',
    category: '소화',
    categoryHanja: '消化',
    text: '대변 상태는 주로 어떤가요?',
    options: [
      { label: '양이 많고 규칙적이다', score: { taeeum: 2 }, dim: { digest: 1 } },
      { label: '단단하고 변비 경향이 있다', score: { soyang: 2 }, dim: { heat: 1 } },
      { label: '무르거나 설사가 잦다', score: { soeum: 2 }, dim: { heat: -1, digest: -1 } },
      { label: '대체로 무난하다', score: { taeyang: 1 } },
    ],
  },
  {
    id: 'urine',
    category: '소화',
    categoryHanja: '消化',
    text: '소변의 특징은?',
    options: [
      { label: '양이 많고 시원하게 나온다', score: { taeyang: 2 } },
      { label: '색이 진하고 양이 적은 편', score: { soyang: 2 }, dim: { heat: 1 } },
      { label: '밤에 자주 깨서 본다', score: { soeum: 2 }, dim: { heat: -1 } },
      { label: '특별히 신경 쓰이지 않는다', score: { taeeum: 1 } },
    ],
  },
  {
    id: 'sweat',
    category: '한열',
    categoryHanja: '寒熱',
    text: '땀은 어떻게 나나요?',
    options: [
      { label: '땀이 많고, 흘리고 나면 개운하다', score: { taeeum: 3 }, dim: { sweat: 2 } },
      { label: '머리·가슴 위주로 나고 열이 오른다', score: { soyang: 2 }, dim: { sweat: 1, heat: 1 } },
      { label: '땀을 흘리면 기운이 쭉 빠진다', score: { soeum: 3 }, dim: { sweat: -1 } },
      { label: '땀이 별로 없는 편이다', score: { taeyang: 1, soeum: 1 }, dim: { sweat: -2 } },
    ],
  },
  {
    id: 'temp',
    category: '한열',
    categoryHanja: '寒熱',
    text: '더위와 추위 중 무엇이 더 힘든가요?',
    options: [
      { label: '더위를 많이 탄다', score: { soyang: 2, taeeum: 1 }, dim: { heat: 2 } },
      { label: '추위를 많이 타고 손발이 차다', score: { soeum: 3 }, dim: { heat: -2 } },
      { label: '더위·추위 모두 많이 탄다', score: { taeeum: 2 }, dim: { heat: 0 } },
      { label: '둘 다 크게 힘들지 않다', score: { taeyang: 1, soyang: 1 } },
    ],
  },
  {
    id: 'water',
    category: '한열',
    categoryHanja: '寒熱',
    text: '즐겨 마시는 물은?',
    options: [
      { label: '찬물을 벌컥벌컥 마신다', score: { soyang: 2 }, dim: { heat: 2 } },
      { label: '따뜻한 물이 편하다', score: { soeum: 2 }, dim: { heat: -2 } },
      { label: '물을 자주, 많이 마신다', score: { taeeum: 2 }, dim: { heat: 1 } },
      { label: '물을 많이 찾지 않는다', score: { taeyang: 1, soeum: 1 } },
    ],
  },
  {
    id: 'hands',
    category: '한열',
    categoryHanja: '寒熱',
    text: '손발의 온도는?',
    options: [
      { label: '항상 따뜻하거나 뜨거운 편', score: { soyang: 2 }, dim: { heat: 2 } },
      { label: '차갑고 시린 편', score: { soeum: 2 }, dim: { heat: -2 } },
      { label: '땀이 나서 축축한 편', score: { taeeum: 2 }, dim: { sweat: 1 } },
      { label: '보통이다', score: { taeyang: 1 } },
    ],
  },
  {
    id: 'skin',
    category: '형색',
    categoryHanja: '形色',
    text: '피부 결은 어떤가요?',
    options: [
      { label: '두껍고 모공이 넓은 편', score: { taeeum: 2 } },
      { label: '희고 부드러우며 얇은 편', score: { soeum: 2 } },
      { label: '열 오르면 쉽게 붉어진다', score: { soyang: 2 }, dim: { heat: 1 } },
      { label: '맑지만 건조하고 마른 편', score: { taeyang: 2 } },
    ],
  },
  {
    id: 'sleep',
    category: '생활',
    categoryHanja: '生活',
    text: '수면 습관은?',
    options: [
      { label: '잠이 많고 깊게 잔다', score: { taeeum: 2 } },
      { label: '예민해서 자주 깬다', score: { soeum: 2 } },
      { label: '짧게 자도 개운하다', score: { soyang: 1, taeyang: 1 } },
      { label: '잠들기까지 오래 걸린다', score: { soeum: 1, soyang: 1 } },
    ],
  },
  {
    id: 'rest',
    category: '생활',
    categoryHanja: '生活',
    text: '쉬는 날 가장 끌리는 것은?',
    options: [
      { label: '새로운 계획이나 일을 구상한다', score: { taeyang: 2 } },
      { label: '밖에 나가 사람들과 활동한다', score: { soyang: 2 }, dim: { extro: 2 } },
      { label: '집에서 편하게 먹고 쉰다', score: { taeeum: 2 } },
      { label: '혼자 조용히 취미를 즐긴다', score: { soeum: 2 }, dim: { extro: -2 } },
    ],
  },
]
