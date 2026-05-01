'use client';

import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('App error caught by ErrorBoundary:', error, info);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex min-h-dvh flex-col items-center justify-center px-6"
          style={{ background: 'var(--color-bg)' }}
        >
          <div
            className="w-full max-w-[440px] rounded-2xl p-6 text-center"
            style={{ background: 'var(--color-card)' }}
          >
            <p style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>⚠️</p>
            <p
              className="mb-2"
              style={{
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
              }}
            >
              앗, 화면을 그리는 중에 오류가 발생했어요
            </p>
            <p
              className="mb-5"
              style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
            >
              데이터는 안전합니다. 아래 버튼으로 다시 시도해 보세요.
            </p>
            <pre
              className="mb-5 overflow-x-auto rounded-xl p-3 text-left"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-3)',
                fontSize: 'var(--text-xxs)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
            </pre>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.reset}
                className="tap h-12 flex-1 rounded-xl"
                style={{
                  background: 'var(--color-gray-100)',
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') window.location.replace('/');
                }}
                className="tap h-12 flex-1 rounded-xl"
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                홈으로
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
