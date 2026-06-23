import { AskTheField } from 'fieldvision-web';

// The slide-out AI assistant. The open panel is absolutely positioned against
// its nearest positioned ancestor, so the frame is position:relative with a
// fixed size (see cfg.overrides.AskTheField — cardMode single).
const noop = async () => {};
const askProject = async () => ({ type: 'text' as const, answer: '' });
const askGeneral = async () => '';

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: 'relative',
      background: '#050507',
      width: 360,
      height: 540,
      overflow: 'hidden',
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
    }}
  >
    {children}
  </div>
);

/** The open assistant panel — intro copy and prompt-chip starters. */
export const Open = () => (
  <Frame>
    <AskTheField
      isOpen
      onToggle={() => {}}
      onAskProject={askProject}
      onAskGeneral={askGeneral}
      onApplyModification={noop}
    />
  </Frame>
);

/** The collapsed handle — the vertical "Ask the Field" tab. */
export const Closed = () => (
  <Frame>
    <AskTheField
      isOpen={false}
      onToggle={() => {}}
      onAskProject={askProject}
      onAskGeneral={askGeneral}
      onApplyModification={noop}
    />
  </Frame>
);
