import { Download } from 'lucide-react';
export function ExportReport({
  url,
  label = 'Export report',
  query = '',
}: {
  url: string;
  label?: string;
  query?: string;
}) {
  return (
    <details className="report-export">
      <summary className="button secondary">
        <Download size={16} />
        {label}
      </summary>
      <div className="button-row" aria-label={label + ' formats'}>
        {['docx', 'xlsx', 'pdf', 'csv', 'json'].map((format) => (
          <a
            key={format}
            className="button secondary"
            href={url + '/' + format + (query ? '?' + query : '')}
          >
            {format === 'docx' ? 'Word' : format === 'xlsx' ? 'Excel' : format.toUpperCase()}
          </a>
        ))}
      </div>
    </details>
  );
}
