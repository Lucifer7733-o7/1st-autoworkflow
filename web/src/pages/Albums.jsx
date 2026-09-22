import { useSearchParams } from 'react-router-dom';
import { useApi } from '../api.js';
import { AlbumGrid } from '../components/CardGrid.jsx';
import { Loading } from './common.jsx';

const SORTS = { title: 'Title', artist: 'Artist', year: 'Year', recent: 'Recently added' };

export default function Albums() {
  const [params, setParams] = useSearchParams();
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'title';
  const albums = useApi(`/albums?sort=${sort}`);
  return (
    <div className="page">
      <div className="section-head">
        <h1>Albums</h1>
        <select value={sort} onChange={(e) => setParams({ sort: e.target.value })} aria-label="Sort albums">
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <Loading state={albums}>{(d) => <AlbumGrid albums={d} />}</Loading>
    </div>
  );
}
