'use client';

import { RefreshCw, Play, Music, Download, Trash2, BarChart2 } from 'lucide-react';
import { ToolbarActionButton } from './toolbar-action-button';

interface AdminToolbarProps {
  niche: string;
}

export function AdminToolbar({ niche }: AdminToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToolbarActionButton
        apiPath="/api/music/sync"
        label="Sincronizar Músicas"
        labelShort="Músicas"
        icon={Music}
      />
      <ToolbarActionButton
        apiPath="/api/scrape"
        body={{ niche }}
        label="Coleta"
        icon={RefreshCw}
      />
      <ToolbarActionButton
        apiPath="/api/ingest"
        body={{ niche }}
        label="Ingerir"
        icon={Download}
        variant="secondary"
      />
      <ToolbarActionButton
        apiPath="/api/schedule"
        body={{ niche }}
        label="Agendar"
        icon={Play}
      />
      <ToolbarActionButton
        apiPath="/api/cleanup"
        body={{ niche }}
        label="Limpar Irrelevantes"
        labelShort="Limpar"
        icon={Trash2}
        variant="destructive"
      />
      <ToolbarActionButton
        apiPath="/api/insights/collect"
        body={{ niche }}
        label="Coletar Insights"
        labelShort="Insights"
        icon={BarChart2}
      />
    </div>
  );
}
