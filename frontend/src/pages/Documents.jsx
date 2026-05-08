import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  DocumentTextIcon, CheckBadgeIcon, ChevronDownIcon, ChevronUpIcon,
  ShieldCheckIcon, FireIcon, VideoCameraIcon, KeyIcon, PrinterIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { documentsForRole, blockingDocumentsForRole } from '../templates/houseDocuments';
import { listAcknowledgementsForUser, signDocument } from '../lib/documents';
import { useAuthStore } from '../stores/authStore';

const ICON_FOR_KIND = {
  rules: KeyIcon,
  policy: FireIcon,
  notice: VideoCameraIcon,
  lease: DocumentTextIcon,
};

function MarkdownLite({ text }) {
  // Lightweight, security-safe rendering — turn `# H1`, `## H2`, `**bold**`
  // and bullet markers into HTML without the regex jungle of a full
  // markdown library. Anything else renders as plain prose.
  const lines = text.split('\n');
  const out = [];
  let buffer = [];
  const flushList = () => {
    if (!buffer.length) return;
    out.push(<ul key={`l-${out.length}`} className="list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-slate-300 my-2">{buffer}</ul>);
    buffer = [];
  };
  lines.forEach((line, i) => {
    if (line.startsWith('# ')) { flushList(); out.push(<h2 key={i} className="text-base font-bold text-slate-900 dark:text-white mt-3 mb-2">{line.slice(2)}</h2>); return; }
    if (line.startsWith('## ')) { flushList(); out.push(<h3 key={i} className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-3 mb-1.5">{line.slice(3)}</h3>); return; }
    if (line.startsWith('- ')) {
      const content = line.slice(2);
      // basic **bold** support
      const parts = content.split(/(\*\*[^*]+\*\*)/g).map((p, idx) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={idx} className="text-slate-900 dark:text-white">{p.slice(2, -2)}</strong>
          : p);
      buffer.push(<li key={i}>{parts}</li>);
      return;
    }
    flushList();
    if (line.trim() === '') { out.push(<div key={i} className="h-2" />); return; }
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, idx) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={idx} className="text-slate-900 dark:text-white">{p.slice(2, -2)}</strong>
        : p);
    out.push(<p key={i} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed my-1">{parts}</p>);
  });
  flushList();
  return <>{out}</>;
}

function DocumentCard({ doc, ack, onSign, onPrint }) {
  const Icon = ICON_FOR_KIND[doc.kind] || DocumentTextIcon;
  const [expanded, setExpanded] = useState(!ack); // expand unsigned by default
  const [signing, setSigning] = useState(false);
  const [signedName, setSignedName] = useState('');
  const profile = useAuthStore((s) => s.profile);

  const startSign = () => {
    setSignedName(profile?.full_name || '');
    setSigning(true);
  };

  const submitSign = async () => {
    if (!signedName.trim()) {
      toast.error('Please type your full name to sign.');
      return;
    }
    await onSign(signedName);
    setSigning(false);
  };

  return (
    <div className={clsx('card overflow-hidden', ack && 'border-emerald-200 dark:border-emerald-700')}>
      <div className="p-4 flex items-start gap-3">
        <div className={clsx(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          ack ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-brand-50 dark:bg-brand-900/30 text-brand-600'
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{doc.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{doc.summary}</p>
            </div>
            {ack ? (
              <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] flex-shrink-0">
                <CheckBadgeIcon className="w-3 h-3" /> Signed
              </span>
            ) : doc.mustAcceptBeforeApproval ? (
              <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] flex-shrink-0">
                Required
              </span>
            ) : null}
          </div>
          {ack?.signed_at && (
            <p className="text-[10px] text-slate-500 mt-1">
              Signed by <span className="font-medium">{ack.signed_name}</span> on{' '}
              {format(new Date(ack.signed_at?.toDate ? ack.signed_at.toDate() : ack.signed_at), 'dd MMM yyyy HH:mm')}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 -mt-2 flex items-center gap-2">
        <button onClick={() => setExpanded((v) => !v)} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1">
          {expanded ? <><ChevronUpIcon className="w-3 h-3" /> Hide</> : <><ChevronDownIcon className="w-3 h-3" /> Read full document</>}
        </button>
        <button onClick={onPrint} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 ml-auto">
          <PrinterIcon className="w-3 h-3" /> Print
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 max-h-96 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-700 pt-3">
          <MarkdownLite text={doc.body} />
        </div>
      )}

      {!ack && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
          {!signing ? (
            <button onClick={startSign} className="btn-primary text-xs">
              <CheckBadgeIcon className="w-3.5 h-3.5" /> Read & Sign
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Type your full legal name below to electronically sign this document.
                A typed signature is a valid e-signature under the South African
                Electronic Communications and Transactions Act (ECTA).
              </p>
              <input
                type="text"
                className="input"
                placeholder="Your full legal name"
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setSigning(false)} className="btn-secondary text-xs">Cancel</button>
                <button onClick={submitSign} disabled={!signedName.trim()} className="btn-primary text-xs">
                  Sign as {signedName || 'me'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Documents() {
  const profile = useAuthStore((s) => s.profile);
  const role = useAuthStore((s) => s.role);
  const qc = useQueryClient();

  const docs = profile ? documentsForRole(role) : [];
  const blocking = blockingDocumentsForRole(role);

  const { data: acks = [] } = useQuery({
    queryKey: ['my-document-acks'],
    queryFn: () => listAcknowledgementsForUser(profile?.id),
    enabled: !!profile?.id,
  });

  const { mutateAsync: sign } = useMutation({
    mutationFn: ({ docId, doc, signedName }) =>
      signDocument(docId, { docVersion: doc.version, docTitle: doc.title, signedName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-document-acks'] });
      toast.success('Document signed');
    },
    onError: (e) => toast.error(e.message || 'Could not sign'),
  });

  const ackByDocId = Object.fromEntries(acks.map((a) => [a.doc_id, a]));
  const blockingMissing = blocking.filter((d) => !ackByDocId[d.id]);

  const printDoc = (doc) => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return toast.error('Pop-up blocked — allow pop-ups to print');
    w.document.write(`
      <html><head><title>${doc.title}</title>
      <style>
        body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #1e293b; line-height: 1.5; }
        h1, h2, h3 { color: #0f172a; }
        h1 { border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; }
        .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
        pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; }
      </style>
      </head><body>
      <h1>${doc.title}</h1>
      <div class="meta">21 Breda Street · Document version ${doc.version} · Printed ${new Date().toLocaleString()}</div>
      <pre>${doc.body.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</pre>
      </body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 200);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">My Documents</h1>
          <p className="text-sm text-slate-500">House rules, lease and policies that apply to you.</p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-emerald-600 font-medium">{acks.length} signed</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">{docs.length - acks.length} outstanding</span>
        </div>
      </div>

      {blockingMissing.length > 0 && (
        <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 p-4">
          <div className="flex items-start gap-2">
            <ShieldCheckIcon className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {blockingMissing.length} document{blockingMissing.length === 1 ? '' : 's'} still need your signature
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-0.5">
                Your account approval depends on signing all required documents.
                Read each one in full and sign at the bottom.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {docs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">
            No documents apply to your role right now.
          </p>
        ) : (
          docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              ack={ackByDocId[doc.id]}
              onSign={(signedName) => sign({ docId: doc.id, doc, signedName })}
              onPrint={() => printDoc(doc)}
            />
          ))
        )}
      </div>
    </div>
  );
}
