import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc, deleteDoc,
  query, where, orderBy, limit as qLimit, serverTimestamp, writeBatch,
  collectionGroup, Timestamp,
} from 'firebase/firestore';
import { db, firebaseAuth } from './firebase';

const ts = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  if (v.toDate) return v.toDate().toISOString();
  if (v.seconds) return new Date(v.seconds * 1000).toISOString();
  return null;
};

const docToObj = (d) => {
  if (!d.exists()) return null;
  const data = d.data();
  return {
    id: d.id,
    ...data,
    created_at: ts(data.created_at),
    updated_at: ts(data.updated_at),
    paid_at: ts(data.paid_at),
    authorized_at: ts(data.authorized_at),
    read_at: ts(data.read_at),
  };
};

const snapToArr = (snap) => snap.docs.map((d) => docToObj(d));

async function loadProfileMap(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const entries = await Promise.all(
    unique.map(async (id) => {
      const snap = await getDoc(doc(db, 'profiles', id));
      return [id, snap.exists() ? { id, ...snap.data() } : null];
    })
  );
  return Object.fromEntries(entries);
}

async function loadRoomMap(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const entries = await Promise.all(
    unique.map(async (id) => {
      const snap = await getDoc(doc(db, 'rooms', id));
      return [id, snap.exists() ? { id, ...snap.data() } : null];
    })
  );
  return Object.fromEntries(entries);
}

async function loadTicketMap(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const entries = await Promise.all(
    unique.map(async (id) => {
      const snap = await getDoc(doc(db, 'tickets', id));
      return [id, snap.exists() ? { id, title: snap.data().title, status: snap.data().status } : null];
    })
  );
  return Object.fromEntries(entries);
}

async function logAudit(action, entityType, entityId, meta = {}) {
  const u = firebaseAuth.currentUser;
  if (!u) return;
  await addDoc(collection(db, 'audit_logs'), {
    user_id: u.uid,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    metadata: meta,
    created_at: serverTimestamp(),
  });
}

async function notifyUser(userId, { title, message, type, entityType, entityId }) {
  if (!userId) return;
  await addDoc(collection(db, 'notifications'), {
    user_id: userId,
    title, message, type,
    entity_type: entityType,
    entity_id: entityId || null,
    read: false,
    created_at: serverTimestamp(),
  });
}

async function notifyRole(role, payload) {
  const snap = await getDocs(query(collection(db, 'profiles'), where('role', '==', role)));
  await Promise.all(snap.docs.map((d) => notifyUser(d.id, payload)));
}

// =============== TICKETS ===============

export const tickets = {
  async list({ status, priority, limit = 100 } = {}) {
    let q = query(collection(db, 'tickets'), orderBy('created_at', 'desc'), qLimit(limit));
    if (status) q = query(collection(db, 'tickets'), where('status', '==', status), orderBy('created_at', 'desc'), qLimit(limit));
    if (priority) q = query(collection(db, 'tickets'), where('priority', '==', priority), orderBy('created_at', 'desc'), qLimit(limit));
    if (status && priority) {
      q = query(
        collection(db, 'tickets'),
        where('status', '==', status),
        where('priority', '==', priority),
        orderBy('created_at', 'desc'),
        qLimit(limit)
      );
    }

    const snap = await getDocs(q);
    const list = snapToArr(snap);

    const roomMap = await loadRoomMap(list.map((t) => t.room_id));
    const profileMap = await loadProfileMap([
      ...list.map((t) => t.assigned_contractor),
      ...list.map((t) => t.created_by),
    ]);

    return list.map((t) => ({
      ...t,
      room: t.room_id ? roomMap[t.room_id] : null,
      assigned_contractor: t.assigned_contractor ? profileMap[t.assigned_contractor] : null,
      created_by_profile: t.created_by ? profileMap[t.created_by] : null,
    }));
  },

  async get(id) {
    const ticketRef = doc(db, 'tickets', id);
    const [ticketSnap, attachSnap, commentSnap, approvalSnap, quotesSnap] = await Promise.all([
      getDoc(ticketRef),
      getDocs(query(collection(ticketRef, 'attachments'), orderBy('created_at', 'desc'))),
      getDocs(query(collection(ticketRef, 'comments'), orderBy('created_at', 'asc'))),
      getDocs(query(collection(ticketRef, 'approvals'), orderBy('created_at', 'desc'))),
      getDocs(query(collection(db, 'quotations'), where('ticket_id', '==', id))),
    ]);

    if (!ticketSnap.exists()) return null;

    const ticket = docToObj(ticketSnap);

    // Comments — enrich author
    const comments = snapToArr(commentSnap);
    const authorIds = [...new Set(comments.map((c) => c.author_id).filter(Boolean))];
    const authorMap = await loadProfileMap(authorIds);
    ticket.comments = comments.map((c) => ({ ...c, author: c.author_id ? authorMap[c.author_id] : null }));

    ticket.attachments = snapToArr(attachSnap);
    ticket.approvals = snapToArr(approvalSnap);

    // Quotations — load items + contractor
    const quotes = await Promise.all(
      quotesSnap.docs.map(async (d) => {
        const itemsSnap = await getDocs(collection(d.ref, 'items'));
        return { ...docToObj(d), items: itemsSnap.docs.map((i) => ({ id: i.id, ...i.data() })) };
      })
    );
    const contractorIds = quotes.map((q) => q.contractor_id);
    const contractorMap = await loadProfileMap(contractorIds);
    ticket.quotations = quotes.map((q) => ({
      ...q,
      contractor: q.contractor_id ? contractorMap[q.contractor_id] : null,
    }));

    // Room
    if (ticket.room_id) {
      const roomMap = await loadRoomMap([ticket.room_id]);
      ticket.room = roomMap[ticket.room_id] || null;
    }

    // Assigned contractor + creator
    const profileMap = await loadProfileMap([ticket.assigned_contractor, ticket.created_by]);
    ticket.assigned_contractor = ticket.assigned_contractor ? profileMap[ticket.assigned_contractor] : null;
    ticket.created_by_profile = ticket.created_by ? profileMap[ticket.created_by] : null;

    return ticket;
  },

  async create(payload) {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');
    const profileSnap = await getDoc(doc(db, 'profiles', u.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : {};

    const data = {
      title: payload.title.trim(),
      description: payload.description.trim(),
      priority: payload.priority || 'medium',
      status: 'pending',
      room_id: payload.room_id || null,
      category: payload.category || null,
      deadline: payload.deadline || null,
      estimated_cost: payload.estimated_cost ? Number(payload.estimated_cost) : null,
      created_by: u.uid,
      created_by_name: profile.full_name || '',
      assigned_contractor: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'tickets'), data);

    await logAudit('ticket_created', 'ticket', ref.id, { title: data.title, priority: data.priority });
    await notifyRole('property_manager', {
      title: 'New Maintenance Ticket',
      message: `"${data.title}" logged with ${data.priority} priority`,
      type: 'ticket_created', entityType: 'ticket', entityId: ref.id,
    });

    const snap = await getDoc(ref);
    return docToObj(snap);
  },

  async update(id, updates) {
    const allowed = ['title', 'description', 'priority', 'status', 'room_id',
      'assigned_contractor', 'deadline', 'category', 'estimated_cost'];
    const clean = { updated_at: serverTimestamp() };
    for (const k of allowed) if (updates[k] !== undefined) clean[k] = updates[k];

    await updateDoc(doc(db, 'tickets', id), clean);
    await logAudit('ticket_updated', 'ticket', id, clean);
    const snap = await getDoc(doc(db, 'tickets', id));
    return docToObj(snap);
  },

  async addComment(ticketId, content) {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');
    const profileSnap = await getDoc(doc(db, 'profiles', u.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : {};

    const ref = await addDoc(collection(db, 'tickets', ticketId, 'comments'), {
      content: content.trim(),
      author_id: u.uid,
      author_name: profile.full_name || '',
      author_role: profile.role || '',
      created_at: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return docToObj(snap);
  },

  async signOff(ticketId, { notes, passed }) {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');
    const profileSnap = await getDoc(doc(db, 'profiles', u.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : {};

    const tSnap = await getDoc(doc(db, 'tickets', ticketId));
    if (!tSnap.exists()) throw new Error('Ticket not found');
    const ticket = tSnap.data();
    if (ticket.status !== 'awaiting_inspection') throw new Error('Ticket is not awaiting inspection');

    const newStatus = passed ? 'completed' : 'in_progress';
    const batch = writeBatch(db);
    batch.update(doc(db, 'tickets', ticketId), { status: newStatus, updated_at: serverTimestamp() });
    const approvalRef = doc(collection(db, 'tickets', ticketId, 'approvals'));
    batch.set(approvalRef, {
      approver_id: u.uid,
      approver_name: profile.full_name || '',
      type: 'inspection',
      decision: passed ? 'approved' : 'rejected',
      notes: notes || null,
      created_at: serverTimestamp(),
    });
    await batch.commit();

    await logAudit(passed ? 'inspection_passed' : 'inspection_failed', 'ticket', ticketId);

    if (ticket.assigned_contractor) {
      await notifyUser(ticket.assigned_contractor, {
        title: passed ? 'Work Signed Off' : 'Re-work Required',
        message: passed
          ? `Your work on "${ticket.title}" has been approved`
          : `"${ticket.title}" requires additional work`,
        type: passed ? 'inspection_passed' : 'inspection_failed',
        entityType: 'ticket', entityId: ticketId,
      });
    }
    return { status: newStatus };
  },

  async addAttachment(ticketId, { file_name, file_url, file_path, file_type, label, mime_type, phase }) {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');
    const ref = await addDoc(collection(db, 'tickets', ticketId, 'attachments'), {
      file_name,
      file_url,
      file_path,
      file_type: file_type || 'image',
      label: label || null,
      mime_type: mime_type || null,
      phase: phase || 'before', // 'before' = issue photo, 'after' = completion photo
      uploaded_by: u.uid,
      created_at: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return docToObj(snap);
  },
};

// =============== QUOTES ===============

export const quotes = {
  async list({ ticket_id, status, contractorId } = {}) {
    let q;
    if (contractorId) {
      q = query(collection(db, 'quotations'), where('contractor_id', '==', contractorId), orderBy('created_at', 'desc'));
    } else if (ticket_id) {
      q = query(collection(db, 'quotations'), where('ticket_id', '==', ticket_id), orderBy('created_at', 'desc'));
    } else if (status) {
      q = query(collection(db, 'quotations'), where('status', '==', status), orderBy('created_at', 'desc'));
    } else {
      q = query(collection(db, 'quotations'), orderBy('created_at', 'desc'));
    }

    const snap = await getDocs(q);
    const list = snapToArr(snap);

    // Items
    const enriched = await Promise.all(list.map(async (q) => {
      const itemsSnap = await getDocs(collection(db, 'quotations', q.id, 'items'));
      return { ...q, items: itemsSnap.docs.map((i) => ({ id: i.id, ...i.data() })) };
    }));

    // Contractors + tickets
    const contractorMap = await loadProfileMap(enriched.map((q) => q.contractor_id));
    const ticketMap = await loadTicketMap(enriched.map((q) => q.ticket_id));

    return enriched.map((q) => ({
      ...q,
      contractor: q.contractor_id ? contractorMap[q.contractor_id] : null,
      ticket: q.ticket_id ? ticketMap[q.ticket_id] : null,
    }));
  },

  async create({ ticket_id, items, valid_until, notes, estimated_days }) {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');
    const profileSnap = await getDoc(doc(db, 'profiles', u.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : {};
    const ticketSnap = await getDoc(doc(db, 'tickets', ticket_id));
    if (!ticketSnap.exists()) throw new Error('Ticket not found');
    const ticket = ticketSnap.data();

    const total_amount = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);

    const ref = await addDoc(collection(db, 'quotations'), {
      ticket_id,
      ticket_title: ticket.title,
      contractor_id: u.uid,
      contractor_name: profile.full_name || '',
      company_name: profile.company_name || null,
      total_amount,
      valid_until: valid_until || null,
      estimated_days: estimated_days ? Number(estimated_days) : null,
      notes: notes || null,
      status: 'submitted',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    const batch = writeBatch(db);
    items.forEach((item) => {
      const iref = doc(collection(db, 'quotations', ref.id, 'items'));
      batch.set(iref, {
        description: item.description,
        item_type: item.item_type || 'labour',
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total: Number(item.quantity) * Number(item.unit_price),
      });
    });
    await batch.commit();

    if (ticket.status === 'pending') {
      await updateDoc(doc(db, 'tickets', ticket_id), {
        status: 'awaiting_quote',
        updated_at: serverTimestamp(),
      });
    }

    await logAudit('quote_submitted', 'quotation', ref.id, { ticket_id, total_amount });
    await notifyRole('property_manager', {
      title: 'New Quote Received',
      message: `R ${total_amount.toFixed(2)} quote for "${ticket.title}"`,
      type: 'quote_submitted', entityType: 'quotation', entityId: ref.id,
    });

    const snap = await getDoc(ref);
    return docToObj(snap);
  },

  async approve(id, { currentRole, notes } = {}) {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');
    const qSnap = await getDoc(doc(db, 'quotations', id));
    if (!qSnap.exists()) throw new Error('Quotation not found');
    const q = qSnap.data();

    const needsOwnerApproval = q.total_amount > 500 && currentRole === 'property_manager';
    const newStatus = needsOwnerApproval ? 'pending_owner_approval' : 'approved';

    if (!needsOwnerApproval) {
      const others = await getDocs(query(collection(db, 'quotations'), where('ticket_id', '==', q.ticket_id)));
      const batch = writeBatch(db);
      batch.update(doc(db, 'quotations', id), { status: newStatus, updated_at: serverTimestamp() });
      others.docs.forEach((d) => {
        if (d.id !== id) batch.update(d.ref, { status: 'rejected', updated_at: serverTimestamp() });
      });
      batch.update(doc(db, 'tickets', q.ticket_id), {
        status: 'approved',
        assigned_contractor: q.contractor_id,
        assigned_contractor_name: q.contractor_name,
        updated_at: serverTimestamp(),
      });
      await batch.commit();
    } else {
      await updateDoc(doc(db, 'quotations', id), { status: newStatus, updated_at: serverTimestamp() });
    }

    await logAudit('quote_approved', 'quotation', id);
    await notifyUser(q.contractor_id, {
      title: needsOwnerApproval ? 'Quote Under Review' : 'Quote Approved!',
      message: needsOwnerApproval
        ? 'Your quote is pending owner approval'
        : `Your quote for "${q.ticket_title}" has been approved`,
      type: 'quote_approved', entityType: 'quotation', entityId: id,
    });
    if (needsOwnerApproval) {
      await notifyRole('property_owner', {
        title: 'Quote Approval Required',
        message: `R ${q.total_amount.toFixed(2)} requires your approval`,
        type: 'quote_pending_owner', entityType: 'quotation', entityId: id,
      });
    }
    return { status: newStatus };
  },

  async reject(id, reason) {
    if (!reason?.trim()) throw new Error('Reason required');
    const qSnap = await getDoc(doc(db, 'quotations', id));
    if (!qSnap.exists()) throw new Error('Quotation not found');
    const q = qSnap.data();

    await updateDoc(doc(db, 'quotations', id), {
      status: 'rejected',
      rejection_reason: reason,
      updated_at: serverTimestamp(),
    });
    await logAudit('quote_rejected', 'quotation', id, { reason });
    await notifyUser(q.contractor_id, {
      title: 'Quote Rejected',
      message: `Your quote for "${q.ticket_title}" was rejected: ${reason}`,
      type: 'quote_rejected', entityType: 'quotation', entityId: id,
    });
    return { status: 'rejected' };
  },
};

// =============== PAYMENTS ===============

export const payments = {
  async list({ status, contractorId } = {}) {
    let q;
    if (contractorId) {
      q = query(collection(db, 'payments'), where('contractor_id', '==', contractorId), orderBy('created_at', 'desc'));
    } else if (status) {
      q = query(collection(db, 'payments'), where('status', '==', status), orderBy('created_at', 'desc'));
    } else {
      q = query(collection(db, 'payments'), orderBy('created_at', 'desc'));
    }
    const snap = await getDocs(q);
    const list = snapToArr(snap);

    const contractorMap = await loadProfileMap(list.map((p) => p.contractor_id));
    const ticketMap = await loadTicketMap(list.map((p) => p.ticket_id));

    return list.map((p) => ({
      ...p,
      contractor: p.contractor_id ? contractorMap[p.contractor_id] : null,
      ticket: p.ticket_id ? ticketMap[p.ticket_id] : null,
    }));
  },

  async create({ ticket_id, contractor_id, amount, payment_method, quote_id, reference, notes }) {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');
    const ticketSnap = await getDoc(doc(db, 'tickets', ticket_id));
    if (!ticketSnap.exists()) throw new Error('Ticket not found');
    const ticket = ticketSnap.data();
    if (ticket.status !== 'completed') throw new Error('Ticket must be completed first');

    const ref = await addDoc(collection(db, 'payments'), {
      ticket_id,
      ticket_title: ticket.title,
      contractor_id,
      quote_id: quote_id || null,
      amount: Number(amount),
      payment_method: payment_method || null,
      reference: reference || null,
      notes: notes || null,
      status: 'pending',
      created_by: u.uid,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    await logAudit('payment_created', 'payment', ref.id, { amount, ticket_id });
    const snap = await getDoc(ref);
    return docToObj(snap);
  },

  async authorize(id, notes = null) {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');
    const pSnap = await getDoc(doc(db, 'payments', id));
    if (!pSnap.exists()) throw new Error('Payment not found');
    const payment = pSnap.data();
    if (payment.status !== 'pending') throw new Error('Payment not pending');

    const batch = writeBatch(db);
    batch.update(doc(db, 'payments', id), {
      status: 'authorized',
      authorized_by: u.uid,
      authorized_at: serverTimestamp(),
      notes: notes || null,
      updated_at: serverTimestamp(),
    });
    batch.update(doc(db, 'tickets', payment.ticket_id), {
      status: 'paid',
      updated_at: serverTimestamp(),
    });
    await batch.commit();

    await notifyUser(payment.contractor_id, {
      title: 'Payment Authorized',
      message: `Payment of R ${Number(payment.amount).toFixed(2)} for "${payment.ticket_title}" has been authorized`,
      type: 'payment_authorized', entityType: 'payment', entityId: id,
    });
    await logAudit('payment_authorized', 'payment', id);
    return { status: 'authorized' };
  },

  async markPaid(id, transaction_ref = null) {
    const pSnap = await getDoc(doc(db, 'payments', id));
    if (!pSnap.exists()) throw new Error('Payment not found');
    const payment = pSnap.data();
    if (payment.status !== 'authorized') throw new Error('Payment must be authorized first');

    await updateDoc(doc(db, 'payments', id), {
      status: 'paid',
      transaction_ref: transaction_ref || null,
      paid_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    await notifyUser(payment.contractor_id, {
      title: 'Payment Sent',
      message: `Your payment of R ${Number(payment.amount).toFixed(2)} has been sent`,
      type: 'payment_sent', entityType: 'payment', entityId: id,
    });
    await logAudit('payment_paid', 'payment', id);
    const snap = await getDoc(doc(db, 'payments', id));
    return docToObj(snap);
  },
};

// =============== CONTRACTORS ===============

export const contractors = {
  async list() {
    const snap = await getDocs(query(collection(db, 'profiles'), where('role', '==', 'contractor')));
    const profiles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return Promise.all(profiles.map(async (c) => {
      const [ratingsSnap, ticketsSnap] = await Promise.all([
        getDocs(query(collection(db, 'contractor_ratings'), where('contractor_id', '==', c.id))),
        getDocs(query(collection(db, 'tickets'), where('assigned_contractor', '==', c.id))),
      ]);
      const ratings = ratingsSnap.docs.map((r) => r.data().rating);
      const avg = ratings.length ? ratings.reduce((s, v) => s + v, 0) / ratings.length : null;
      const ticketsArr = ticketsSnap.docs.map((t) => t.data());
      const completed = ticketsArr.filter((t) => ['completed', 'paid'].includes(t.status)).length;
      return {
        ...c,
        avg_rating: avg ? Math.round(avg * 10) / 10 : null,
        total_jobs: ticketsArr.length,
        completed_jobs: completed,
        completion_rate: ticketsArr.length ? Math.round((completed / ticketsArr.length) * 100) : null,
      };
    }));
  },

  async get(id) {
    const snap = await getDoc(doc(db, 'profiles', id));
    if (!snap.exists() || snap.data().role !== 'contractor') return null;
    const [ratingsSnap, quotesSnap, ticketsSnap] = await Promise.all([
      getDocs(query(collection(db, 'contractor_ratings'), where('contractor_id', '==', id))),
      getDocs(query(collection(db, 'quotations'), where('contractor_id', '==', id))),
      getDocs(query(collection(db, 'tickets'), where('assigned_contractor', '==', id))),
    ]);
    return {
      id: snap.id, ...snap.data(),
      ratings: ratingsSnap.docs.map((r) => ({ id: r.id, ...r.data() })),
      quotations: quotesSnap.docs.map((q) => ({ id: q.id, ...q.data() })),
      assigned_tickets: ticketsSnap.docs.map((t) => ({ id: t.id, ...t.data() })),
    };
  },

  async rate(id, { ticket_id, rating, category, comment }) {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');
    const existing = await getDocs(query(
      collection(db, 'contractor_ratings'),
      where('contractor_id', '==', id),
      where('ticket_id', '==', ticket_id),
      where('category', '==', category),
    ));
    const data = {
      contractor_id: id, ticket_id,
      rated_by: u.uid,
      rating: Number(rating), category,
      comment: comment || null,
      created_at: serverTimestamp(),
    };
    if (!existing.empty) {
      await updateDoc(existing.docs[0].ref, data);
      return { id: existing.docs[0].id, ...data };
    }
    const ref = await addDoc(collection(db, 'contractor_ratings'), data);
    return { id: ref.id, ...data };
  },
};

// =============== DASHBOARD ===============

export const dashboard = {
  async stats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [tSnap, pSnap, cSnap, qSnap] = await Promise.all([
      getDocs(collection(db, 'tickets')),
      getDocs(query(collection(db, 'payments'), where('created_at', '>=', Timestamp.fromDate(thirtyDaysAgo)))),
      getDocs(query(collection(db, 'profiles'), where('role', '==', 'contractor'))),
      getDocs(query(collection(db, 'quotations'), where('status', 'in', ['submitted', 'pending_owner_approval']))),
    ]);

    const tArr = tSnap.docs.map((d) => d.data());
    const pArr = pSnap.docs.map((d) => d.data());

    const byStatus = tArr.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
    const byPriority = tArr.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {});

    const overdue = tArr.filter((t) => {
      if (!t.deadline) return false;
      return new Date(t.deadline) < now && !['completed', 'paid', 'rejected'].includes(t.status);
    }).length;

    const monthlySpend = pArr.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
    const pendingPayments = pArr.filter((p) => p.status === 'authorized').reduce((s, p) => s + Number(p.amount), 0);

    return {
      tickets: {
        total: tArr.length,
        by_status: byStatus,
        by_priority: byPriority,
        overdue,
        active: tArr.filter((t) => !['completed', 'paid', 'rejected'].includes(t.status)).length,
      },
      finances: {
        monthly_spend: monthlySpend,
        pending_payments: pendingPayments,
        total_invoiced_30d: pArr.reduce((s, p) => s + Number(p.amount), 0),
      },
      contractors: { total: cSnap.size },
      approvals: { pending: qSnap.size },
    };
  },

  async activity(lim = 20) {
    const snap = await getDocs(query(collection(db, 'audit_logs'), orderBy('created_at', 'desc'), qLimit(lim)));
    const logs = snapToArr(snap);
    const profileMap = await loadProfileMap(logs.map((l) => l.user_id));
    return logs.map((l) => ({
      ...l,
      user: l.user_id ? (profileMap[l.user_id] ? { full_name: profileMap[l.user_id].full_name, role: profileMap[l.user_id].role } : null) : null,
    }));
  },

  async costs(months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - Number(months));
    const snap = await getDocs(query(
      collection(db, 'payments'),
      where('status', '==', 'paid'),
      where('created_at', '>=', Timestamp.fromDate(since)),
    ));
    const monthly = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      const t = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);
      const m = t.toISOString().slice(0, 7);
      monthly[m] = (monthly[m] || 0) + Number(data.amount);
    });
    return Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));
  },

  async notifications({ unreadOnly = false, lim = 30 } = {}) {
    const u = firebaseAuth.currentUser;
    if (!u) return { notifications: [], unread_count: 0 };
    let q = query(
      collection(db, 'notifications'),
      where('user_id', '==', u.uid),
      orderBy('created_at', 'desc'),
      qLimit(lim),
    );
    if (unreadOnly) {
      q = query(
        collection(db, 'notifications'),
        where('user_id', '==', u.uid),
        where('read', '==', false),
        orderBy('created_at', 'desc'),
        qLimit(lim),
      );
    }
    const snap = await getDocs(q);
    const notifications = snapToArr(snap);
    const unread_count = notifications.filter((n) => !n.read).length;
    return { notifications, unread_count };
  },

  async markRead(id) {
    const u = firebaseAuth.currentUser;
    if (!u) return;
    if (id === 'all') {
      const snap = await getDocs(query(
        collection(db, 'notifications'),
        where('user_id', '==', u.uid),
        where('read', '==', false),
      ));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { read: true, read_at: serverTimestamp() }));
      await batch.commit();
    } else {
      await updateDoc(doc(db, 'notifications', id), { read: true, read_at: serverTimestamp() });
    }
  },

  async rooms() {
    const [roomsSnap, ticketsSnap] = await Promise.all([
      getDocs(query(collection(db, 'rooms'), orderBy('number'))),
      getDocs(collection(db, 'tickets')),
    ]);
    const ticketsByRoom = {};
    ticketsSnap.docs.forEach((d) => {
      const t = d.data();
      if (t.room_id) {
        if (!ticketsByRoom[t.room_id]) ticketsByRoom[t.room_id] = [];
        ticketsByRoom[t.room_id].push({ id: d.id, status: t.status });
      }
    });
    return roomsSnap.docs.map((d) => ({
      id: d.id, ...d.data(),
      tickets: ticketsByRoom[d.id] || [],
    }));
  },
};

// =============== PROFILES ===============

export const profiles = {
  async list() {
    const snap = await getDocs(query(collection(db, 'profiles'), orderBy('created_at', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async listByRole(role) {
    const snap = await getDocs(query(collection(db, 'profiles'), where('role', '==', role)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async listPending() {
    const snap = await getDocs(query(
      collection(db, 'profiles'),
      where('approval_status', '==', 'pending'),
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => p.registration_complete); // hide auto-bootstrapped placeholder profiles
  },

  async get(id) {
    const snap = await getDoc(doc(db, 'profiles', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async upsertSelf(values) {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');
    const ref = doc(db, 'profiles', u.uid);
    const snap = await getDoc(ref);
    const exists = snap.exists();
    const updates = { updated_at: serverTimestamp() };
    const allowed = [
      'full_name', 'phone', 'company_name', 'avatar_url',
      'id_number', 'marital_status', 'work_address',
      'next_of_kin_name', 'next_of_kin_phone',
      'medical_conditions',
      'previous_address', 'previous_landlord_name', 'previous_landlord_phone',
      'previous_was_owner', 'previous_landlord_contact_consent', 'previous_address_comment',
      'monthly_nett_income',
      'services',
      'banking_account_holder', 'banking_bank', 'banking_account_number', 'banking_branch_code',
    ];
    for (const k of allowed) if (values[k] !== undefined) updates[k] = values[k];

    if (!exists) {
      await setDoc(ref, {
        ...updates,
        full_name: updates.full_name || u.displayName || u.email,
        email: u.email || null,
        role: values.role || 'resident',
        is_active: false,
        approval_status: 'pending',
        registration_complete: false,
        created_at: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, updates);
    }
    const after = await getDoc(ref);
    return { id: after.id, ...after.data() };
  },

  /** Admin only: approve a pending registration. */
  async approve(uid, { role } = {}) {
    const ref = doc(db, 'profiles', uid);
    const updates = {
      approval_status: 'approved',
      is_active: true,
      approved_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    if (role) updates.role = role;
    await updateDoc(ref, updates);
    await logAudit('user_approved', 'profile', uid, { role: role || null });
    await notifyUser(uid, {
      title: 'Account approved',
      message: 'Your registration has been approved. You now have full access.',
      type: 'account_approved',
      entityType: 'profile',
      entityId: uid,
    });
  },

  async reject(uid, reason) {
    const ref = doc(db, 'profiles', uid);
    await updateDoc(ref, {
      approval_status: 'rejected',
      is_active: false,
      rejection_reason: reason || null,
      updated_at: serverTimestamp(),
    });
    await logAudit('user_rejected', 'profile', uid, { reason });
    await notifyUser(uid, {
      title: 'Account rejected',
      message: reason ? `Your registration was rejected: ${reason}` : 'Your registration was rejected.',
      type: 'account_rejected',
      entityType: 'profile',
      entityId: uid,
    });
  },

  async setRole(uid, role) {
    await updateDoc(doc(db, 'profiles', uid), { role, updated_at: serverTimestamp() });
  },

  async setActive(uid, is_active) {
    await updateDoc(doc(db, 'profiles', uid), { is_active, updated_at: serverTimestamp() });
  },
};

// =============== REGISTRATION ===============
// Public registration writes the full profile in one go, plus a banking
// subdoc (kept separate so the `profiles` doc isn't full of sensitive data).
// References for contractors are stored as a subcollection.
export const registration = {
  async submit({
    role,
    common,         // { full_name, phone, id_number, avatar_url, work_address?, next_of_kin_name?, next_of_kin_phone?, medical_conditions? }
    tenant,         // { marital_status, monthly_nett_income, previous_address, previous_was_owner, previous_landlord_name, previous_landlord_phone, previous_landlord_contact_consent, previous_address_comment, credit_check_consent }
    contractor,     // { company_name, services }
    references,     // [{ name, phone }] — contractor only
    banking,        // { account_holder, bank, account_number, branch_code }
  }) {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');

    const profileRef = doc(db, 'profiles', u.uid);
    const profilePayload = {
      email: u.email || null,
      role,
      is_active: false,
      approval_status: 'pending',
      registration_complete: true,
      ...common,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    if (role === 'tenant') {
      Object.assign(profilePayload, tenant || {});
    } else if (role === 'contractor') {
      Object.assign(profilePayload, contractor || {});
    }

    await setDoc(profileRef, profilePayload, { merge: true });

    // Banking — separate doc, owner-only readable later via rules
    if (banking && (banking.account_number || banking.bank)) {
      await setDoc(doc(db, 'banking_details', u.uid), {
        ...banking,
        user_id: u.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    }

    // Contractor references
    if (role === 'contractor' && Array.isArray(references) && references.length) {
      const batch = writeBatch(db);
      // Clear any existing first
      const existing = await getDocs(collection(db, 'profiles', u.uid, 'references'));
      existing.docs.forEach((d) => batch.delete(d.ref));
      references.forEach((r) => {
        if (!r.name?.trim()) return;
        const ref = doc(collection(db, 'profiles', u.uid, 'references'));
        batch.set(ref, { name: r.name.trim(), phone: r.phone?.trim() || null, created_at: serverTimestamp() });
      });
      await batch.commit();
    }

    await logAudit('registration_submitted', 'profile', u.uid, { role });
    await notifyRole('admin', {
      title: 'New registration to approve',
      message: `${common.full_name || u.email} registered as ${role}`,
      type: 'registration_submitted',
      entityType: 'profile',
      entityId: u.uid,
    });
    await notifyRole('property_owner', {
      title: 'New registration to approve',
      message: `${common.full_name || u.email} registered as ${role}`,
      type: 'registration_submitted',
      entityType: 'profile',
      entityId: u.uid,
    });

    return { uid: u.uid };
  },
};

// =============== ROOMS (CRUD) ===============
export const roomsApi = {
  async list() {
    const snap = await getDocs(query(collection(db, 'rooms'), orderBy('number')));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const tenantIds = list.map((r) => r.tenant_id).filter(Boolean);
    const tenantMap = await loadProfileMap(tenantIds);
    return list.map((r) => ({ ...r, tenant: r.tenant_id ? tenantMap[r.tenant_id] : null }));
  },

  async get(id) {
    const snap = await getDoc(doc(db, 'rooms', id));
    if (!snap.exists()) return null;
    const data = { id: snap.id, ...snap.data() };
    if (data.tenant_id) {
      const tenantSnap = await getDoc(doc(db, 'profiles', data.tenant_id));
      data.tenant = tenantSnap.exists() ? { id: tenantSnap.id, ...tenantSnap.data() } : null;
    }
    return data;
  },

  async create(payload) {
    const ref = await addDoc(collection(db, 'rooms'), {
      ...payload,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() };
  },

  async update(id, updates) {
    await updateDoc(doc(db, 'rooms', id), { ...updates, updated_at: serverTimestamp() });
    const snap = await getDoc(doc(db, 'rooms', id));
    return { id: snap.id, ...snap.data() };
  },

  async remove(id) {
    await deleteDoc(doc(db, 'rooms', id));
  },
};
