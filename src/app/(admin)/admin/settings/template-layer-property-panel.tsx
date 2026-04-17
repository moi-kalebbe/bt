'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type {
  AnyLayer,
  StoryTemplateConfig,
  BackgroundBlurLayer,
  ImageLayer,
  GradientLayer,
  TextLayer,
  ShapeLayer,
  GradientStop,
  TextSource,
} from '@/types/story-template';

interface Props {
  layer: AnyLayer;
  config: StoryTemplateConfig;
  onConfigChange: (config: StoryTemplateConfig) => void;
}

function updateLayer<T extends AnyLayer>(config: StoryTemplateConfig, id: string, patch: Partial<T>): StoryTemplateConfig {
  return {
    ...config,
    layers: config.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <Input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-7 text-xs"
    />
  );
}

function BackgroundBlurPanel({ layer, config, onConfigChange }: { layer: BackgroundBlurLayer } & Pick<Props, 'config' | 'onConfigChange'>) {
  const update = useCallback((patch: Partial<BackgroundBlurLayer>) => onConfigChange(updateLayer(config, layer.id, patch)), [config, layer.id, onConfigChange]);
  return (
    <div className="space-y-2">
      <Field label="Desfoque (px)">
        <NumInput value={layer.blurRadius} onChange={(v) => update({ blurRadius: v })} min={1} max={30} />
      </Field>
      <Field label="Brilho">
        <NumInput value={layer.brightness} onChange={(v) => update({ brightness: v })} min={0} max={1} step={0.05} />
      </Field>
    </div>
  );
}

function ImagePanel({ layer, config, onConfigChange }: { layer: ImageLayer } & Pick<Props, 'config' | 'onConfigChange'>) {
  const update = useCallback((patch: Partial<ImageLayer>) => onConfigChange(updateLayer(config, layer.id, patch)), [config, layer.id, onConfigChange]);
  return (
    <div className="space-y-2">
      <Field label="X"><NumInput value={layer.x} onChange={(v) => update({ x: v })} min={0} max={1080} /></Field>
      <Field label="Y"><NumInput value={layer.y} onChange={(v) => update({ y: v })} min={0} max={1920} /></Field>
      <Field label="Largura"><NumInput value={layer.width} onChange={(v) => update({ width: v })} min={1} max={1080} /></Field>
      <Field label="Altura"><NumInput value={layer.height} onChange={(v) => update({ height: v })} min={1} max={1920} /></Field>
      <Field label="Encaixe">
        <select
          value={layer.fit}
          onChange={(e) => update({ fit: e.target.value as ImageLayer['fit'] })}
          className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="cover">cover</option>
          <option value="contain">contain</option>
          <option value="fill">fill</option>
        </select>
      </Field>
      <Field label="Posição">
        <select
          value={layer.position}
          onChange={(e) => update({ position: e.target.value as ImageLayer['position'] })}
          className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="top">topo</option>
          <option value="center">centro</option>
          <option value="bottom">baixo</option>
        </select>
      </Field>
    </div>
  );
}

function GradientPanel({ layer, config, onConfigChange }: { layer: GradientLayer } & Pick<Props, 'config' | 'onConfigChange'>) {
  const update = useCallback((patch: Partial<GradientLayer>) => onConfigChange(updateLayer(config, layer.id, patch)), [config, layer.id, onConfigChange]);

  const updateStop = (index: number, patch: Partial<GradientStop>) => {
    const stops = layer.stops.map((s, i) => (i === index ? { ...s, ...patch } : s));
    update({ stops });
  };

  const addStop = () => update({ stops: [...layer.stops, { offset: 0.5, color: '#000000', opacity: 0.5 }] });
  const removeStop = (i: number) => update({ stops: layer.stops.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-2">
      <Field label="X"><NumInput value={layer.x} onChange={(v) => update({ x: v })} min={0} max={1080} /></Field>
      <Field label="Y"><NumInput value={layer.y} onChange={(v) => update({ y: v })} min={0} max={1920} /></Field>
      <Field label="Largura"><NumInput value={layer.width} onChange={(v) => update({ width: v })} min={1} max={1080} /></Field>
      <Field label="Altura"><NumInput value={layer.height} onChange={(v) => update({ height: v })} min={1} max={1920} /></Field>
      <Field label="Direção">
        <select
          value={layer.direction}
          onChange={(e) => update({ direction: e.target.value as GradientLayer['direction'] })}
          className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="to-bottom">baixo</option>
          <option value="to-top">cima</option>
          <option value="to-right">direita</option>
          <option value="to-left">esquerda</option>
        </select>
      </Field>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Paradas de cor</p>
        {layer.stops.map((stop, i) => (
          <div key={i} className="flex items-center gap-1 mb-1">
            <Input
              type="number"
              value={stop.offset}
              min={0} max={1} step={0.05}
              onChange={(e) => updateStop(i, { offset: Number(e.target.value) })}
              className="h-6 w-14 text-xs"
              title="Offset (0–1)"
            />
            <input
              type="color"
              value={stop.color}
              onChange={(e) => updateStop(i, { color: e.target.value })}
              className="h-6 w-8 rounded border cursor-pointer"
              title="Cor"
            />
            <Input
              type="number"
              value={stop.opacity}
              min={0} max={1} step={0.05}
              onChange={(e) => updateStop(i, { opacity: Number(e.target.value) })}
              className="h-6 w-14 text-xs"
              title="Opacidade (0–1)"
            />
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeStop(i)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={addStop}>
          <Plus className="h-3 w-3" />parada
        </Button>
      </div>
    </div>
  );
}

const TEXT_SOURCES: { value: TextSource; label: string }[] = [
  { value: 'title', label: 'Título' },
  { value: 'summary', label: 'Resumo' },
  { value: 'niche_label', label: 'Chip de categoria' },
  { value: 'source_name', label: 'Fonte' },
  { value: 'custom', label: 'Texto fixo' },
  { value: 'full_text_block', label: 'Bloco completo (Classic)' },
];

function TextPanel({ layer, config, onConfigChange }: { layer: TextLayer } & Pick<Props, 'config' | 'onConfigChange'>) {
  const update = useCallback((patch: Partial<TextLayer>) => onConfigChange(updateLayer(config, layer.id, patch)), [config, layer.id, onConfigChange]);

  return (
    <div className="space-y-2">
      <Field label="Conteúdo">
        <select
          value={layer.source}
          onChange={(e) => update({ source: e.target.value as TextSource })}
          className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          {TEXT_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      {layer.source === 'custom' && (
        <Field label="Texto">
          <Input value={layer.customValue ?? ''} onChange={(e) => update({ customValue: e.target.value })} className="h-7 text-xs" />
        </Field>
      )}
      <Field label="X"><NumInput value={layer.x} onChange={(v) => update({ x: v })} min={0} max={1080} /></Field>
      <Field label="Y"><NumInput value={layer.y} onChange={(v) => update({ y: v })} min={0} max={1920} /></Field>
      <Field label="Largura"><NumInput value={layer.width} onChange={(v) => update({ width: v })} min={1} max={1080} /></Field>
      <Field label="Altura"><NumInput value={layer.height} onChange={(v) => update({ height: v })} min={1} max={1920} /></Field>
      <Field label="Fonte (px)"><NumInput value={layer.fontSize} onChange={(v) => update({ fontSize: v })} min={8} max={200} /></Field>
      <Field label="Peso">
        <select
          value={layer.fontWeight}
          onChange={(e) => update({ fontWeight: Number(e.target.value) as 400 | 700 })}
          className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value={400}>Normal (400)</option>
          <option value={700}>Negrito (700)</option>
        </select>
      </Field>
      <Field label="Cor">
        <div className="flex items-center gap-1">
          <input type="color" value={layer.color.startsWith('#') ? layer.color : '#FFFFFF'} onChange={(e) => update({ color: e.target.value })} className="h-7 w-8 rounded border cursor-pointer" />
          <Input value={layer.color} onChange={(e) => update({ color: e.target.value })} className="h-7 text-xs flex-1" />
        </div>
      </Field>
      <Field label="Entrelinhas"><NumInput value={layer.lineHeight} onChange={(v) => update({ lineHeight: v })} min={0.8} max={3} step={0.05} /></Field>
      <Field label="Truncar em"><NumInput value={layer.truncateAt ?? 0} onChange={(v) => update({ truncateAt: v || undefined })} min={0} max={500} /></Field>
      <Field label="Fundo (chip)">
        <div className="flex items-center gap-1">
          <input type="color" value={layer.backgroundColor?.startsWith('#') ? layer.backgroundColor : '#FF6B00'} onChange={(e) => update({ backgroundColor: e.target.value })} className="h-7 w-8 rounded border cursor-pointer" />
          <Input value={layer.backgroundColor ?? ''} onChange={(e) => update({ backgroundColor: e.target.value || undefined })} placeholder="nenhum" className="h-7 text-xs flex-1" />
        </div>
      </Field>
      {layer.backgroundColor && (
        <>
          <Field label="Pad. X"><NumInput value={layer.paddingX ?? 16} onChange={(v) => update({ paddingX: v })} min={0} max={100} /></Field>
          <Field label="Pad. Y"><NumInput value={layer.paddingY ?? 6} onChange={(v) => update({ paddingY: v })} min={0} max={100} /></Field>
          <Field label="Raio borda"><NumInput value={layer.borderRadius ?? 4} onChange={(v) => update({ borderRadius: v })} min={0} max={100} /></Field>
        </>
      )}
    </div>
  );
}

function ShapePanel({ layer, config, onConfigChange }: { layer: ShapeLayer } & Pick<Props, 'config' | 'onConfigChange'>) {
  const update = useCallback((patch: Partial<ShapeLayer>) => onConfigChange(updateLayer(config, layer.id, patch)), [config, layer.id, onConfigChange]);
  const isAbsolute = layer.anchor === 'absolute';

  return (
    <div className="space-y-2">
      <Field label="Cor">
        <div className="flex items-center gap-1">
          <input type="color" value={layer.backgroundColor} onChange={(e) => update({ backgroundColor: e.target.value })} className="h-7 w-8 rounded border cursor-pointer" />
          <Input value={layer.backgroundColor} onChange={(e) => update({ backgroundColor: e.target.value })} className="h-7 text-xs flex-1" />
        </div>
      </Field>
      <Field label="Largura">
        <div className="flex items-center gap-1">
          <Input
            value={layer.width === 'full' ? 'full' : String(layer.width)}
            onChange={(e) => update({ width: e.target.value === 'full' ? 'full' : Number(e.target.value) })}
            className="h-7 text-xs"
            placeholder="px ou 'full'"
          />
        </div>
      </Field>
      <Field label="Altura"><NumInput value={layer.height} onChange={(v) => update({ height: v })} min={1} max={1920} /></Field>
      <Field label="Raio borda"><NumInput value={layer.borderRadius ?? 0} onChange={(v) => update({ borderRadius: v })} min={0} max={100} /></Field>
      <Field label="Posição abs.">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={isAbsolute}
            onChange={(e) => update({ anchor: e.target.checked ? 'absolute' : undefined })}
            className="h-4 w-4"
          />
          <span className="text-xs">Absoluta (bottom/left)</span>
        </label>
      </Field>
      {isAbsolute ? (
        <>
          <Field label="Bottom"><NumInput value={layer.bottom ?? 0} onChange={(v) => update({ bottom: v })} min={0} max={1920} /></Field>
          <Field label="Left"><NumInput value={layer.left ?? 0} onChange={(v) => update({ left: v })} min={0} max={1080} /></Field>
        </>
      ) : (
        <>
          <Field label="X"><NumInput value={layer.x} onChange={(v) => update({ x: v })} min={0} max={1080} /></Field>
          <Field label="Y"><NumInput value={layer.y} onChange={(v) => update({ y: v })} min={0} max={1920} /></Field>
        </>
      )}
    </div>
  );
}

export function TemplateLayerPropertyPanel({ layer, config, onConfigChange }: Props) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Propriedades — {layer.label}
        </p>
        <Field label="Label">
          <Input
            value={layer.label}
            onChange={(e) =>
              onConfigChange({
                ...config,
                layers: config.layers.map((l) => (l.id === layer.id ? { ...l, label: e.target.value } : l)),
              })
            }
            className="h-7 text-xs"
          />
        </Field>
      </div>

      {layer.type === 'background_blur' && (
        <BackgroundBlurPanel layer={layer} config={config} onConfigChange={onConfigChange} />
      )}
      {layer.type === 'image' && (
        <ImagePanel layer={layer} config={config} onConfigChange={onConfigChange} />
      )}
      {layer.type === 'gradient' && (
        <GradientPanel layer={layer} config={config} onConfigChange={onConfigChange} />
      )}
      {layer.type === 'text' && (
        <TextPanel layer={layer} config={config} onConfigChange={onConfigChange} />
      )}
      {layer.type === 'shape' && (
        <ShapePanel layer={layer} config={config} onConfigChange={onConfigChange} />
      )}
    </div>
  );
}
