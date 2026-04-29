import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #00C75A 0%, #008C40 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg viewBox="0 0 100 100" width={120} height={120}>
          <g style={{ filter: 'drop-shadow(0 1.5px 0 rgba(0,0,0,0.18))' }}>
            <path
              d="M16 26 L36 76 L50 38 L64 76 L84 26"
              fill="none"
              stroke="#fff"
              strokeWidth={11}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <line x1={20} y1={50} x2={80} y2={50} stroke="#fff" strokeWidth={7} strokeLinecap="round" />
            <line x1={20} y1={62} x2={80} y2={62} stroke="#fff" strokeWidth={7} strokeLinecap="round" />
          </g>
        </svg>
      </div>
    ),
    { ...size },
  );
}
