'use client';

import { useState, useCallback } from 'react';
import { Separator } from '@/components/ui/separator';
import { TemplateSlotCard } from './template-slot-card';
import { TemplateEditorModal } from './template-editor-modal';
import type { StoryTemplate } from '@/types/story-template';

interface TemplateEditorSectionProps {
  niche: string;
  initialTemplates: StoryTemplate[];
}

export function TemplateEditorSection({ niche, initialTemplates }: TemplateEditorSectionProps) {
  const [templates, setTemplates] = useState<StoryTemplate[]>(initialTemplates);
  const [editingSlot, setEditingSlot] = useState<1 | 2 | 3 | null>(null);

  const editingTemplate = templates.find((t) => t.slot === editingSlot) ?? null;

  const handleToggleActive = useCallback(async (slot: 1 | 2 | 3, isActive: boolean) => {
    const template = templates.find((t) => t.slot === slot);
    if (!template) return;

    const res = await fetch(`/api/news/templates/${slot}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, is_active: isActive }),
    });
    const json = await res.json();
    if (json.template) {
      setTemplates((prev) => prev.map((t) => (t.slot === slot ? json.template : t)));
    }
  }, [niche, templates]);

  const handleSave = useCallback((updated: StoryTemplate) => {
    setTemplates((prev) => prev.map((t) => (t.slot === updated.slot ? updated : t)));
  }, []);

  return (
    <>
      <Separator />

      <div>
        <h2 className="text-base font-semibold mb-1">Templates de Story</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Defina até 3 layouts para o nicho atual. O sistema sorteia aleatoriamente entre os templates ativos ao gerar cada story.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((slot) => {
            const template = templates.find((t) => t.slot === slot);
            if (!template) {
              return (
                <div key={slot} className="rounded-lg border border-dashed flex items-center justify-center h-24 text-xs text-muted-foreground">
                  Slot {slot} — carregando…
                </div>
              );
            }
            return (
              <TemplateSlotCard
                key={slot}
                template={template}
                onEdit={() => setEditingSlot(slot as 1 | 2 | 3)}
                onToggleActive={(active) => handleToggleActive(slot as 1 | 2 | 3, active)}
              />
            );
          })}
        </div>
      </div>

      {editingTemplate && (
        <TemplateEditorModal
          template={editingTemplate}
          niche={niche}
          open={editingSlot !== null}
          onClose={() => setEditingSlot(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
}
