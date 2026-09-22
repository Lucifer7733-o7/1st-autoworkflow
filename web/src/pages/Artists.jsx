import { useApi } from '../api.js';
import { ArtistGrid } from '../components/CardGrid.jsx';
import { Loading } from './common.jsx';

export default function Artists() {
  const artists = useApi('/artists');
  return (
    <div className="page">
      <h1>Artists</h1>
      <Loading state={artists}>{(d) => <ArtistGrid artists={d} />}</Loading>
    </div>
  );
}
