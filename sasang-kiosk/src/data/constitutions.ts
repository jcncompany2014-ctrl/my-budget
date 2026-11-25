export type TypeKey = 'taeyang' | 'soyang' | 'taeeum' | 'soeum'

export const TYPE_KEYS: TypeKey[] = ['taeyang', 'soyang', 'taeeum', 'soeum']

export interface Constitution {
  key: TypeKey
  name: string
  hanja: string
  color: string
  organ: string // 장부 대소
  organHanja: string
  summary: string
  body: string[]
  mind: string[]
  caution: string[]
  healthSign: string // 건강할 때의 신호
  weakPoints: string[]
  foodGood: string[]
  foodAvoid: string[]
  exercise: string[]
  lifestyle: string[]
  prevalence: string
}

export const CONSTITUTIONS: Record<TypeKey, Constitution> = {
  taeyang: {
    key: 'taeyang',
    name: '태양인',
    hanja: '太陽人',
    color: '#E0683F',
    organ: '폐대간소',
    organHanja: '肺大肝小',
    summary: '뻗어 나가는 기운이 강한 체질. 폐 기능이 크고 간 기능이 상대적으로 작아, 기운이 위로 오르고 아래로 내려가는 힘이 약한 경향이 있습니다.',
    body: ['머리와 목덜미가 발달하고 상체가 건실함', '허리 아래·하체가 상대적으로 약함', '눈빛이 맑고 강한 인상'],
    mind: ['진취적이고 창의적인 사고', '결단력과 추진력이 뛰어남', '사교적이며 앞장서는 리더형'],
    caution: ['일이 뜻대로 되지 않을 때 조급해지기 쉬움', '독단적으로 보일 수 있으니 경청이 중요'],
    healthSign: '소변이 시원하고 양이 충분하면 건강한 상태',
    weakPoints: ['하체 무력감·쉽게 다리가 피로함', '음식이 잘 내려가지 않는 느낌', '과로 시 눈의 피로'],
    foodGood: ['메밀', '새우·조개·굴', '포도·다래·키위', '솔잎·오가피차', '푸른 잎채소', '냉면류(담백)'],
    foodAvoid: ['기름진 육류', '맵고 자극적인 음식', '과음', '고열량 튀김'],
    exercise: ['걷기·계단 오르기 등 하체 강화', '스쿼트·런지', '호흡 명상'],
    lifestyle: ['한 템포 쉬고 결정하기', '타인의 의견을 끝까지 듣기', '분노를 오래 품지 않기'],
    prevalence: '매우 드묾',
  },
  soyang: {
    key: 'soyang',
    name: '소양인',
    hanja: '少陽人',
    color: '#E3A93C',
    organ: '비대신소',
    organHanja: '脾大腎小',
    summary: '열이 많고 순발력이 좋은 체질. 비위(소화기)의 기운이 크고 신(腎)의 기운이 상대적으로 작아, 열이 위로 몰리기 쉬운 경향이 있습니다.',
    body: ['가슴과 어깨가 발달, 엉덩이·하체는 가벼운 편', '움직임과 걸음이 빠르고 날렵함', '턱선이 갸름하고 입술이 얇은 편'],
    mind: ['솔직하고 명랑하며 정의감이 강함', '판단이 빠르고 순발력이 좋음', '봉사심이 있고 남의 일에 적극적'],
    caution: ['시작은 빠르나 마무리가 약해지기 쉬움', '성급한 판단과 감정 기복'],
    healthSign: '대변이 막힘없이 잘 통하면 건강한 상태',
    weakPoints: ['상체로 열이 몰림·안면 홍조', '변비 경향', '허리·하체 및 비뇨기 기능 약화'],
    foodGood: ['돼지고기·오리고기', '보리·녹두·팥', '오이·배추·우엉', '수박·참외·딸기', '굴·전복·해삼', '구기자차'],
    foodAvoid: ['매운 음식·고추', '닭고기·인삼·꿀 등 열성 식품', '과음', '튀김·자극적 양념'],
    exercise: ['수영·하체 근력 운동', '요가·스트레칭', '과도한 땀보다 꾸준한 리듬'],
    lifestyle: ['시작한 일은 끝까지 마무리하기', '열을 식히는 충분한 수분과 휴식', '감정이 오를 때 잠시 거리두기'],
    prevalence: '약 30%',
  },
  taeeum: {
    key: 'taeeum',
    name: '태음인',
    hanja: '太陰人',
    color: '#4FA07F',
    organ: '간대폐소',
    organHanja: '肝大肺小',
    summary: '저장하고 축적하는 기운이 강한 체질. 간의 기운이 크고 폐의 기운이 상대적으로 작아, 흡수는 잘 되나 발산이 약한 경향이 있습니다.',
    body: ['골격이 크고 체격이 건실함', '허리가 발달하고 서 있는 자세가 안정적', '이목구비가 크고 뚜렷한 편'],
    mind: ['끈기 있고 묵묵하게 일을 완수함', '포용력이 크고 신중함', '한번 맺은 관계를 오래 유지'],
    caution: ['변화를 겁내고 결정을 미루기 쉬움', '욕심과 고집이 강해질 수 있음'],
    healthSign: '땀이 잘 나고 땀 흘린 뒤 개운하면 건강한 상태',
    weakPoints: ['체중 증가·순환 정체', '호흡기·피부 트러블', '혈압·혈당 관리 필요'],
    foodGood: ['소고기', '콩·두부·율무', '무·도라지·연근', '버섯류', '밤·호두·잣', '배·자두'],
    foodAvoid: ['과식·야식', '고지방·고당분 음식', '단 음료', '정제 밀가루 과다'],
    exercise: ['땀을 충분히 내는 유산소(등산·조깅)', '사우나·반신욕', '주 4회 이상 규칙적 활동'],
    lifestyle: ['미루지 말고 바로 실행하기', '식사량을 정해두고 천천히 먹기', '새로운 경험에 마음 열기'],
    prevalence: '약 50%',
  },
  soeum: {
    key: 'soeum',
    name: '소음인',
    hanja: '少陰人',
    color: '#5E86CF',
    organ: '신대비소',
    organHanja: '腎大脾小',
    summary: '섬세하고 안으로 모으는 기운이 강한 체질. 신(腎)의 기운이 크고 비위(소화기)의 기운이 상대적으로 작아, 몸이 차고 소화력이 약해지기 쉬운 경향이 있습니다.',
    body: ['체구가 아담하고 상하체 균형이 단정함', '엉덩이·하체가 상체보다 발달', '이목구비가 오밀조밀하고 부드러운 인상'],
    mind: ['꼼꼼하고 계획적이며 논리적', '차분하고 섬세한 감수성', '신뢰할 수 있는 성실함'],
    caution: ['걱정이 많고 마음이 불안해지기 쉬움', '내성적이라 감정을 속으로 삭임'],
    healthSign: '소화가 잘 되고 식욕이 좋으면 건강한 상태',
    weakPoints: ['소화불량·더부룩함', '손발이 차고 추위를 탐', '땀을 많이 흘리면 기운이 빠짐'],
    foodGood: ['닭고기·양고기', '찹쌀·차조', '생강·대추·쑥', '부추·파·마늘', '사과·귤', '인삼·계피차'],
    foodAvoid: ['찬 음식·얼음 음료', '날 것·회 과다', '돼지고기·밀가루 과다', '수박·참외'],
    exercise: ['걷기·요가 등 가벼운 운동', '땀을 과하게 빼지 않는 강도', '복부를 따뜻하게 하는 호흡'],
    lifestyle: ['걱정은 적어두고 덜어내기', '몸을 따뜻하게 유지', '소식하되 규칙적으로 식사'],
    prevalence: '약 20%',
  },
}

// 사상의학 4장부 (폐·비·간·신)
export const ORGANS = [
  { key: 'lung', name: '폐', hanja: '肺' },
  { key: 'spleen', name: '비', hanja: '脾' },
  { key: 'liver', name: '간', hanja: '肝' },
  { key: 'kidney', name: '신', hanja: '腎' },
] as const

export type OrganKey = (typeof ORGANS)[number]['key']

// 체질별 장부 대소 효과: +큼, -작음
export const ORGAN_EFFECT: Record<TypeKey, Record<OrganKey, number>> = {
  taeyang: { lung: 1, spleen: 0, liver: -1, kidney: 0 },
  soyang: { lung: 0, spleen: 1, liver: 0, kidney: -1 },
  taeeum: { lung: -1, spleen: 0, liver: 1, kidney: 0 },
  soeum: { lung: 0, spleen: -1, liver: 0, kidney: 1 },
}
