import { LineItemsTable } from 'fieldvision-web';

// Confirmable contract line items extracted from an uploaded PDF.
const noop = async () => {};

const item = (id: string, text: string, trade: string | null, confirmed: boolean) => ({
  id,
  project_id: 'p1',
  text,
  trade,
  quantity: null,
  unit: null,
  notes: null,
  confirmed,
});

const MIXED = [
  item('1', 'Demolition of existing kitchen cabinetry and countertops', 'Demolition', true),
  item('2', 'Rough framing for new pantry wall and soffit', 'Wood & Plastics', true),
  item('3', 'Relocate sink plumbing and add dishwasher supply line', 'Plumbing', false),
  item('4', 'Add (6) recessed LED fixtures and under-cabinet circuit', 'Electrical', false),
  item('5', 'Install quartz countertops and full-height backsplash', 'Finishes', false),
];

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: '#0A0A0A',
      padding: 20,
      width: 440,
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
    }}
  >
    {children}
  </div>
);

/** Extracted items, some confirmed — the "Confirm All" affordance shows. */
export const Default = () => (
  <Frame>
    <LineItemsTable items={MIXED} onUpdate={noop} onConfirmAll={noop} />
  </Frame>
);

/** Every item confirmed (green state, no "Confirm All"). */
export const AllConfirmed = () => (
  <Frame>
    <LineItemsTable
      items={MIXED.map((i) => ({ ...i, confirmed: true }))}
      onUpdate={noop}
      onConfirmAll={noop}
    />
  </Frame>
);

/** Empty state before any PDF has been parsed. */
export const Empty = () => (
  <Frame>
    <LineItemsTable items={[]} onUpdate={noop} onConfirmAll={noop} />
  </Frame>
);
