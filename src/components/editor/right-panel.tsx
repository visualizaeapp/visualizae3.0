
'use client';

import LayersPanel from './layers-panel';

export default function RightPanel() {
  return (
    <aside className="w-80 h-full bg-card flex-col hidden lg:flex overflow-hidden rounded-r-lg">
        <LayersPanel />
    </aside>
  );
}
