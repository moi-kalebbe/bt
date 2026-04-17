'use client';

interface TemplatePreviewPaneProps {
  imageBase64: string | null;
  loading: boolean;
}

export function TemplatePreviewPane({ imageBase64, loading }: TemplatePreviewPaneProps) {
  return (
    <div className="w-[270px] h-[480px] overflow-hidden rounded-lg border bg-muted relative shrink-0">
      {loading && (
        <div className="absolute inset-0 bg-muted animate-pulse rounded-lg z-10" />
      )}
      {imageBase64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageBase64}
          alt="Preview do template"
          className="w-full h-full object-cover"
        />
      )}
      {!loading && !imageBase64 && (
        <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
          <div className="text-2xl">🖼️</div>
          <p className="text-xs text-muted-foreground">
            Clique em "Atualizar Preview" ou edite uma camada para ver o resultado
          </p>
        </div>
      )}
    </div>
  );
}
