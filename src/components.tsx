import React, { useEffect, useRef } from 'react';
import { X, Leaf, FileSearch, LoaderCircle, ArrowUpRight } from 'lucide-react';
import { label, type Item } from './api';
import { useWorkspace } from './context';
import { Bell } from 'lucide-react';
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <Leaf size={22} />
      </span>
      carbon<span className="brand-x">x</span>
      <small>INTELLIGENCE</small>
    </span>
  );
}
export function Badge({ value }: { value: string }) {
  return <span className={'badge badge-' + value}>{label(value)}</span>;
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span>
        <FileSearch size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Spinner() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" /> Loading workspace…
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('button,input,select')?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const items = ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input,select,textarea,a[href]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', key);
      prior?.focus();
    };
  }, []);
  return (
    <div
      className="backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={'modal ' + (wide ? 'modal-wide' : '')}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label: caption,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{caption}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Panel({
  title,
  kicker,
  children,
  action,
  className = '',
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={'panel ' + className}>
      <div className="panel-heading">
        <div>
          {kicker && <span className="eyebrow">{kicker}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function SdgChips({ goals, reference = [] }: { goals: number[]; reference?: Item[] }) {
  return (
    <span className="sdg-chips">
      {goals.length ? (
        goals.map((id) => (
          <span
            title={reference.find((g) => g.id === id)?.title}
            key={id}
            style={
              {
                '--sdg': reference.find((g) => g.id === id)?.color || '#16834d',
              } as React.CSSProperties
            }
          >
            SDG {id}
          </span>
        ))
      ) : (
        <small>Mapping pending</small>
      )}
    </span>
  );
}
export function SourceLink({
  reportId,
  page,
  label: caption = 'Open source',
}: {
  reportId: string;
  page?: number;
  label?: string;
}) {
  return (
    <a
      className="text-link"
      href={'/api/reports/' + reportId + '/file' + (page ? '#page=' + page : '')}
      target="_blank"
      rel="noreferrer"
    >
      {caption}
      <ArrowUpRight size={14} />
    </a>
  );
}
export function Jobs({ jobs }: { jobs: Item[] }) {
  const active = jobs
    .filter((j) => ['running', 'queued', 'failed', 'interrupted'].includes(j.status))
    .slice(0, 3);
  if (!active.length) return null;
  return (
    <div className="jobs">
      {active.map((j) => (
        <div className={'job ' + j.status} key={j.id}>
          <div>
            <strong>
              {label(j.type)} · {j.stage}
            </strong>
            <small>{j.error || 'Progress is saved in the workspace.'}</small>
          </div>
          <Badge value={j.status} />
          <progress max={100} value={j.progress} />
        </div>
      ))}
    </div>
  );
}

export function NotificationBell() {
  const { data, user } = useWorkspace();
  const count = data.monitoring.notifications.filter((n: Item) => !n.read_at).length;
  return (
    <a
      className="notification-bell icon-button"
      href={user?.portal === 'government' ? '#gov-monitoring' : '#monitoring'}
      aria-label={'Notifications, ' + count + ' unread'}
    >
      <Bell size={18} />
      {count > 0 && <b>{count > 99 ? '99+' : count}</b>}
    </a>
  );
}

export function SectionTabs({ pages, view }: { pages: string[][]; view: string }) {
  if (pages.length < 2) return null;
  return (
    <nav className="section-tabs" aria-label="Section views">
      {pages.map(([id, title]) => (
        <a href={'#' + id} key={id} aria-current={view === id ? 'page' : undefined}>
          {title}
        </a>
      ))}
    </nav>
  );
}
