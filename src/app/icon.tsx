import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #00D964 0%, #00A050 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 112,
        }}
      >
        {/* ₩ — clean W with two horizontal bars cleared of W stem overlap */}
        <svg viewBox="0 0 100 100" width={340} height={340}>
          <g style={{ filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.16))' }}>
            <path
              d="M14 24 L34 78 L50 36 L66 78 L86 24"
              fill="none"
              stroke="#fff"
              strokeWidth={12}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <line x1={26} y1={44} x2={74} y2={44} stroke="#fff" strokeWidth={5} strokeLinecap="round" />
            <line x1={30} y1={56} x2={70} y2={56} stroke="#fff" strokeWidth={5} strokeLinecap="round" />
          </g>
        </svg>
      </div>
    ),
    { ...size },
  );
}
