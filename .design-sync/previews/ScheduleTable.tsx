import { ScheduleTable } from 'fieldvision-web';

// The editable, drag-reorderable task table. Fills its parent (h-full), so
// each cell gives it a fixed-height dark frame.
const task = (
  id: string,
  name: string,
  trade: string,
  start_date: string,
  end_date: string,
  duration_days: number,
  depends_on: string[],
  sequence_index: number,
) => ({ id, project_id: 'p1', name, trade, start_date, end_date, duration_days, depends_on, sequence_index });

const TASKS = [
  task('t1', 'Site prep & demolition', 'Demolition', '2026-03-02', '2026-03-04', 3, [], 0),
  task('t2', 'Rough framing', 'Wood & Plastics', '2026-03-05', '2026-03-11', 5, ['t1'], 1),
  task('t3', 'Plumbing rough-in', 'Plumbing', '2026-03-12', '2026-03-16', 3, ['t2'], 2),
  task('t4', 'Electrical rough-in', 'Electrical', '2026-03-12', '2026-03-16', 3, ['t2'], 3),
  task('t5', 'HVAC rough-in', 'HVAC', '2026-03-17', '2026-03-18', 2, ['t3', 't4'], 4),
  task('t6', 'Insulation', 'Thermal & Moisture', '2026-03-19', '2026-03-20', 2, ['t5'], 5),
  task('t7', 'Drywall & tape', 'Finishes', '2026-03-23', '2026-03-26', 4, ['t6'], 6),
  task('t8', 'Cabinetry & millwork', 'Wood & Plastics', '2026-03-27', '2026-03-31', 3, ['t7'], 7),
];

const noop = () => {};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: '#0A0A0A',
      width: 880,
      height: 420,
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
    }}
  >
    {children}
  </div>
);

/** A populated schedule — inline-editable cells, dependency picker, reorder handles. */
export const Default = () => (
  <Frame>
    <ScheduleTable
      tasks={TASKS}
      allTasks={TASKS}
      onReorder={noop}
      onUpdateTask={noop}
      onAddTask={noop}
      onDeleteTask={noop}
      selectedTaskId={null}
      onSelectTask={noop}
    />
  </Frame>
);

/** A row selected (blue inset ring). */
export const RowSelected = () => (
  <Frame>
    <ScheduleTable
      tasks={TASKS}
      allTasks={TASKS}
      onReorder={noop}
      onUpdateTask={noop}
      onAddTask={noop}
      onDeleteTask={noop}
      selectedTaskId="t3"
      onSelectTask={noop}
    />
  </Frame>
);

/** Empty state — the "No Schedule Yet" call to action. */
export const Empty = () => (
  <Frame>
    <ScheduleTable
      tasks={[]}
      allTasks={[]}
      onReorder={noop}
      onUpdateTask={noop}
      onAddTask={noop}
      onDeleteTask={noop}
      selectedTaskId={null}
      onSelectTask={noop}
    />
  </Frame>
);
