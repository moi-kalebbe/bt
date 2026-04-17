'use client';

import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Image, AlignLeft, Layers, Minus, Blend, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AnyLayer, LayerType, StoryTemplateConfig } from '@/types/story-template';
import { v4 as uuidv4 } from 'uuid';

const LAYER_ICONS: Record<LayerType, React.ReactNode> = {
  background_blur: <Blend className="h-3.5 w-3.5" />,
  image: <Image className="h-3.5 w-3.5" />,
  gradient: <Layers className="h-3.5 w-3.5" />,
  text: <AlignLeft className="h-3.5 w-3.5" />,
  shape: <Minus className="h-3.5 w-3.5" />,
};

const NEW_LAYER_DEFAULTS: Record<LayerType, Partial<AnyLayer>> = {
  background_blur: { type: 'background_blur', label: 'Fundo desfocado', visible: true, opacity: 1, blurRadius: 12, brightness: 0.4 },
  image: { type: 'image', label: 'Imagem', visible: true, opacity: 1, source: 'cover', x: 0, y: 0, width: 1080, height: 1150, fit: 'cover', position: 'top' },
  gradient: { type: 'gradient', label: 'Gradiente', visible: true, opacity: 1, x: 0, y: 550, width: 1080, height: 1370, direction: 'to-bottom', stops: [{ offset: 0, color: '#000000', opacity: 0 }, { offset: 0.35, color: '#000000', opacity: 0.65 }, { offset: 1, color: '#000000', opacity: 0.97 }] },
  text: { type: 'text', label: 'Texto', visible: true, opacity: 1, source: 'title', x: 72, y: 1200, width: 936, height: 300, fontSize: 56, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.25, truncateAt: 80 },
  shape: { type: 'shape', label: 'Barra', visible: true, opacity: 1, shape: 'rectangle', x: 0, y: 0, width: 'full', height: 8, backgroundColor: '#FF6B00', anchor: 'absolute', bottom: 0, left: 0 },
};

interface SortableLayerRowProps {
  layer: AnyLayer;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onDelete: () => void;
}

function SortableLayerRow({ layer, isSelected, onSelect, onToggleVisible, onDelete }: SortableLayerRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer select-none ${isDragging ? 'opacity-50' : ''} ${isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
    >
      <button
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="text-muted-foreground shrink-0">{LAYER_ICONS[layer.type]}</span>
      <span className="flex-1 truncate">{layer.label}</span>
      <button
        className="shrink-0 text-muted-foreground hover:text-foreground"
        onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
      >
        {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
      <button
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

interface TemplateLayerListProps {
  config: StoryTemplateConfig;
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onConfigChange: (config: StoryTemplateConfig) => void;
}

export function TemplateLayerList({
  config,
  selectedLayerId,
  onSelectLayer,
  onConfigChange,
}: TemplateLayerListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = config.layers.findIndex((l) => l.id === active.id);
      const newIndex = config.layers.findIndex((l) => l.id === over.id);
      onConfigChange({ ...config, layers: arrayMove(config.layers, oldIndex, newIndex) });
    },
    [config, onConfigChange],
  );

  const toggleVisible = useCallback(
    (id: string) => {
      onConfigChange({
        ...config,
        layers: config.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
      });
    },
    [config, onConfigChange],
  );

  const deleteLayer = useCallback(
    (id: string) => {
      onConfigChange({ ...config, layers: config.layers.filter((l) => l.id !== id) });
    },
    [config, onConfigChange],
  );

  const addLayer = useCallback(
    (type: LayerType) => {
      const defaults = NEW_LAYER_DEFAULTS[type];
      const newLayer = { ...defaults, id: uuidv4() } as AnyLayer;
      onConfigChange({ ...config, layers: [...config.layers, newLayer] });
    },
    [config, onConfigChange],
  );

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Camadas</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={config.layers.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {config.layers.map((layer) => (
            <SortableLayerRow
              key={layer.id}
              layer={layer}
              isSelected={selectedLayerId === layer.id}
              onSelect={() => onSelectLayer(layer.id)}
              onToggleVisible={() => toggleVisible(layer.id)}
              onDelete={() => deleteLayer(layer.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex gap-1 flex-wrap mt-2">
        {(['background_blur', 'image', 'gradient', 'text', 'shape'] as LayerType[]).map((type) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            className="h-6 text-xs gap-1 px-2"
            onClick={() => addLayer(type)}
          >
            <Plus className="h-3 w-3" />
            {type === 'background_blur' ? 'blur' : type}
          </Button>
        ))}
      </div>
    </div>
  );
}
