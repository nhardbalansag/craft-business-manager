import { memo, useEffect, useMemo, useState } from 'react';

interface SourceOption {
  id: string;
  name: string;
  isActive: boolean;
  baseUnit?: string;
}

interface ComponentSourcePickerProps {
  sources: readonly SourceOption[];
  label: string;
  searchLabel: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  help?: string;
}

const RESULT_LIMIT = 40;
function normalize(value: string) { return value.trim().toLowerCase(); }

/** Keep large catalogs out of native selects and skip rebuilding options while the form is edited. */
export const ComponentSourcePicker = memo(function ComponentSourcePicker({
  sources, label, searchLabel, value, onChange, disabled, placeholder, help,
}: ComponentSourcePickerProps) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(RESULT_LIMIT);
  const indexed = useMemo(() => sources.map((source) => ({
    source, text: normalize(`${source.name} ${source.id}`),
  })), [sources]);
  const matches = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return indexed.filter((entry) => terms.every((term) => entry.text.includes(term))).map((entry) => entry.source);
  }, [indexed, query]);
  const displayed = matches.slice(0, limit);
  const selected = useMemo(() => sources.find((source) => source.id === value), [sources, value]);
  if (selected && !displayed.some((source) => source.id === selected.id)) displayed.unshift(selected);

  useEffect(() => {
    if (!value) { setQuery(''); setLimit(RESULT_LIMIT); }
  }, [value]);

  return <div className="component-source-picker">
    <label className="field"><span>{searchLabel}</span>
      <input type="search" value={query} disabled={disabled} placeholder="Search by name or code"
        onChange={(event) => { setQuery(event.target.value); setLimit(RESULT_LIMIT); }} />
    </label>
    <label className="field"><span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {displayed.map((source) => <option key={source.id} value={source.id}>
          {source.name} · {source.id}{source.baseUnit ? ` · ${source.baseUnit}` : ''}{source.isActive ? '' : ' (archived)'}
        </option>)}
      </select>
      {help && <small>{help}</small>}
    </label>
    <small role="status">{matches.length ? `Showing ${Math.min(limit, matches.length)} of ${matches.length} matches${selected && !matches.includes(selected) ? ' · current selection kept' : ''}` : 'No matching sources. Try another name or code.'}</small>
    {matches.length > limit && <button type="button" className="text-button" disabled={disabled} onClick={() => setLimit((current) => current + RESULT_LIMIT)}>Show more sources</button>}
  </div>;
});
