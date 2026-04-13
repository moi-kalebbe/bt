import { syncViralTracks } from './src/services/music.service';

async function run() {
  console.log('Testing sync...');
  const res = await syncViralTracks(3);
  console.log('Result:', res);
}

run().catch(console.error);
