import { getTracks } from '@/infra/supabase/repositories/viral_tracks.repository';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Music } from 'lucide-react';

export async function MusicList() {
  const tracks = await getTracks(10); // Mostra as últimas 10

  return (
    <Card className="mt-6">
      <CardHeader className="py-3 bg-muted/50">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Music className="w-4 h-4 text-muted-foreground" />
          Rádio Viral (Top 10)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {tracks.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            Nenhuma música virais sincronizada.
          </div>
        ) : (
          <ul className="divide-y max-h-[300px] overflow-y-auto">
            {tracks.map((track) => (
              <li key={track.id} className="p-3 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium truncate" title={track.title}>
                    {track.title}
                  </span>
                  <span className="text-xs text-muted-foreground truncate" title={track.artist || ''}>
                    {track.artist || 'Desconhecido'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
