'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Save } from 'lucide-react';
import { TemplatePreviewPane } from './template-preview-pane';
import { TemplateLayerList } from './template-layer-list';
import { TemplateLayerPropertyPanel } from './template-layer-property-panel';
import type { StoryTemplate, StoryTemplateConfig, PreviewSampleData } from '@/types/story-template';

interface TemplateEditorModalProps {
  template: StoryTemplate;
  niche: string;
  open: boolean;
  onClose: () => void;
  onSave: (updated: StoryTemplate) => void;
}

const SAMPLE_DATA: Record<string, PreviewSampleData> = {
  'beach-tennis': {
    title: 'Dupla brasileira vence torneio internacional de Beach Tennis em Roma',
    summary: 'Competição reuniu mais de 300 atletas de 40 países neste fim de semana na capital italiana.',
    sourceName: 'BT Brasil',
    chipLabel: 'BEACH TENNIS',
    coverImageUrl: '',
  },
  'ai-tech': {
    title: 'OpenAI lança novo modelo com capacidade de raciocínio avançado',
    summary: 'O modelo supera benchmarks anteriores em tarefas de matemática, código e análise científica.',
    sourceName: 'TechCrunch',
    chipLabel: 'IA & TECH',
    coverImageUrl: '',
  },
};

function getSampleData(niche: string): PreviewSampleData {
  return SAMPLE_DATA[niche] ?? SAMPLE_DATA['ai-tech'];
}

export function TemplateEditorModal({
  template,
  niche,
  open,
  onClose,
  onSave,
}: TemplateEditorModalProps) {
  const [config, setConfig] = useState<StoryTemplateConfig>(template.config);
  const [name, setName] = useState(template.name);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when template changes
  useEffect(() => {
    setConfig(template.config);
    setName(template.name);
    setSelectedLayerId(null);
    setPreviewBase64(null);
  }, [template]);

  const fetchPreview = useCallback(async (cfg: StoryTemplateConfig) => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/news/templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg, sampleData: getSampleData(niche) }),
      });
      const json = await res.json();
      if (json.imageBase64) setPreviewBase64(json.imageBase64);
    } catch {
      // silently ignore preview errors
    } finally {
      setPreviewLoading(false);
    }
  }, [niche]);

  // Auto-preview with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPreview(config), 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [config, fetchPreview]);

  const handleConfigChange = useCallback((newConfig: StoryTemplateConfig) => {
    setConfig(newConfig);
  }, []);

  const handleCodeChange = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as StoryTemplateConfig;
      setConfig(parsed);
      setCodeError(null);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : 'JSON inválido');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/news/templates/${template.slot}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, name, config, is_active: template.is_active }),
      });
      const json = await res.json();
      if (json.template) {
        onSave(json.template);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedLayer = config.layers.find((l) => l.id === selectedLayerId) ?? null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl w-full h-[680px] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="text-base">Editar Template — Slot {template.slot}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-row gap-4 flex-1 min-h-0 px-4 pb-4">
          {/* Left — Preview */}
          <div className="flex flex-col gap-2 shrink-0">
            <TemplatePreviewPane imageBase64={previewBase64} loading={previewLoading} />
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs gap-1"
              onClick={() => fetchPreview(config)}
              disabled={previewLoading}
            >
              <RefreshCw className={`h-3 w-3 ${previewLoading ? 'animate-spin' : ''}`} />
              Atualizar Preview
            </Button>
          </div>

          {/* Right — Editor */}
          <div className="flex flex-col flex-1 min-w-0 gap-2 overflow-hidden">
            {/* Name */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground shrink-0">Nome:</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 text-xs flex-1" />
              <Button size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={handleSave} disabled={saving}>
                <Save className="h-3 w-3" />
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>

            <Tabs defaultValue="visual" className="flex flex-col flex-1 min-h-0">
              <TabsList className="h-7 shrink-0">
                <TabsTrigger value="visual" className="text-xs h-6">Visual</TabsTrigger>
                <TabsTrigger value="code" className="text-xs h-6">Código</TabsTrigger>
              </TabsList>

              <TabsContent value="visual" className="flex-1 min-h-0 overflow-hidden mt-2">
                <div className="flex gap-3 h-full">
                  {/* Layer list */}
                  <div className="w-[180px] shrink-0 overflow-y-auto">
                    <TemplateLayerList
                      config={config}
                      selectedLayerId={selectedLayerId}
                      onSelectLayer={setSelectedLayerId}
                      onConfigChange={handleConfigChange}
                    />
                  </div>

                  {/* Property panel */}
                  <div className="flex-1 overflow-y-auto border-l pl-3">
                    {selectedLayer ? (
                      <TemplateLayerPropertyPanel
                        layer={selectedLayer}
                        config={config}
                        onConfigChange={handleConfigChange}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground pt-2">
                        Selecione uma camada para editar suas propriedades.
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="code" className="flex-1 min-h-0 mt-2 flex flex-col gap-1">
                {codeError && (
                  <p className="text-xs text-destructive shrink-0">{codeError}</p>
                )}
                <textarea
                  value={JSON.stringify(config, null, 2)}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  className="flex-1 w-full font-mono text-xs p-2 bg-muted rounded border resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  spellCheck={false}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
