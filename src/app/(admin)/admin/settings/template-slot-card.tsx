'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Pencil } from 'lucide-react';
import type { StoryTemplate } from '@/types/story-template';

interface TemplateSlotCardProps {
  template: StoryTemplate;
  onEdit: () => void;
  onToggleActive: (isActive: boolean) => void;
}

export function TemplateSlotCard({ template, onEdit, onToggleActive }: TemplateSlotCardProps) {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      await onToggleActive(checked);
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="secondary" className="shrink-0 font-mono text-xs">
              T{template.slot}
            </Badge>
            <CardTitle className="text-sm truncate">{template.name}</CardTitle>
          </div>
          <Switch
            checked={template.is_active}
            onCheckedChange={handleToggle}
            disabled={toggling}
            aria-label={`Ativar template ${template.slot}`}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {template.config.layers.filter((l) => l.visible).length} camadas ativas
          {' · '}
          {template.is_active ? (
            <span className="text-green-600 dark:text-green-400">ativo</span>
          ) : (
            <span className="text-muted-foreground">inativo</span>
          )}
        </p>
        <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
          Editar
        </Button>
      </CardContent>
    </Card>
  );
}
