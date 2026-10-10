import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NewAttendanceApi, LmsAttendanceApi } from '../core/services';
import { CheckCircle, XCircle, Clock, Calendar, AlertCircle, RefreshCw } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}
function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtDuration(min: number | null) {
  if (min == null) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Correction Request Modal ──────────────────────────────────────────────────
const CorrectionModal = ({
  record,
  onClose,
  onSubmit,
}: {
  record: any;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (reason.trim().length < 5) return;
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Request Attendance Correction</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Class: <strong>{record.className}</strong> on {fmtDate(record.joinedAt)}
        </p>

        {done ? (
          <div className="text-center py-6">
            <CheckCircle className="mx-auto text-green-500 mb-3" size={40} />
            <p className="font-semibold text-gray-900 dark:text-white">Request Submitted!</p>
            <p className="text-sm text-gray-500 mt-1">The admin will review your request shortly.</p>
            <button
              onClick={onClose}
              className="mt-5 px-5 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
              Reason <span className="font-normal text-gray-400">(min 5 chars)</span>
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you believe the attendance is incorrect..."
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm p-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={submitting || reason.trim().length < 5}
                onClick={handleSubmit}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'PRESENT')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-700/50">
        <CheckCircle size={11} /> Present
      </span>
    );
  if (status === 'ABSENT')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-700/50">
        <XCircle size={11} /> Absent
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50">
      <Clock size={11} /> Pending
    </span>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const StudentAttendancePage = () => {
  const [correctionModal, setCorrectionModal] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'sessions'>('daily');

  const {
    data,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['myLmsAttendance'],
    queryFn: async () => {
      let res: any = null;
      try {
        res = await LmsAttendanceApi.getMyAttendance();
      } catch (e) {
        res = await NewAttendanceApi.getMyAttendance();
      }

      const resData = res?.data?.data || res?.data || {};
      const rawRecords = resData.records || (Array.isArray(resData) ? resData : []);
      const records = rawRecords.map((r: any) => ({
        ...r,
        status: r.status || 'PRESENT',
      }));

      // Daily deduplication logic
      const dailyMap: Record<string, { date: string; status: 'PRESENT' | 'ABSENT'; sessionsCount: number; sessions: any[] }> = {};
      records.forEach((r: any) => {
        const dtIso = r.joinedAt || r.createdAt || new Date().toISOString();
        const dateStr = dtIso.split('T')[0];
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = {
            date: dateStr,
            status: 'ABSENT',
            sessionsCount: 0,
            sessions: [],
          };
        }
        dailyMap[dateStr].sessionsCount += 1;
        dailyMap[dateStr].sessions.push(r);
        if (r.status === 'PRESENT') {
          dailyMap[dateStr].status = 'PRESENT';
        }
      });

      const dailyRecords = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));
      const totalPresentDays = dailyRecords.filter(d => d.status === 'PRESENT').length;
      const totalAbsentDays = dailyRecords.filter(d => d.status === 'ABSENT').length;

      return {
        records,
        dailyRecords,
        summary: {
          totalClasses: records.length,
          totalPresentDays,
          totalAbsentDays,
          presentCount: records.filter((r: any) => r.status === 'PRESENT').length,
          absentCount: records.filter((r: any) => r.status === 'ABSENT').length,
          totalHours: resData.summary?.totalHours || parseFloat((records.length * 1).toFixed(1)),
        }
      };
    },
    refetchOnWindowFocus: true,
  });

  const records: any[] = data?.records || [];
  const dailyRecords: any[] = data?.dailyRecords || [];
  const summary: any = data?.summary || {};

  const handleRequestCorrection = async (attendanceId: string, reason: string) => {
    await LmsAttendanceApi.requestCorrection(attendanceId, reason);
    await refetch();
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Online & Live Class Attendance</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Attending any live class marks your daily attendance as <strong className="text-green-600 dark:text-green-400">PRESENT</strong> (multiple sessions on the same date count as 1 Present day).
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-900 border border-green-200 dark:border-green-700/40 rounded-2xl p-4 sm:p-5 shadow-sm">
          <p className="text-[10px] sm:text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-1 sm:mb-2">Present Days</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-green-600 dark:text-green-400">{summary.totalPresentDays ?? 0}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Unique days attended</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm">
          <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 sm:mb-2">Live Classes</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{summary.totalClasses ?? 0}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Total sessions</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-700/40 rounded-2xl p-4 sm:p-5 shadow-sm">
          <p className="text-[10px] sm:text-xs font-semibold text-red-500 uppercase tracking-wide mb-1 sm:mb-2">Absent Days</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-red-600 dark:text-red-400">{summary.totalAbsentDays ?? 0}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Days missed</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-700/40 rounded-2xl p-4 sm:p-5 shadow-sm">
          <p className="text-[10px] sm:text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1 sm:mb-2">Total Attended</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{summary.totalHours ?? 0}h</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Class duration</p>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-full sm:w-fit">
        <button
          onClick={() => setViewMode('daily')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            viewMode === 'daily'
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          📅 Daily Attendance Summary
        </button>
        <button
          onClick={() => setViewMode('sessions')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            viewMode === 'sessions'
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          📹 Live Class Sessions ({records.length})
        </button>
      </div>

      {/* Table / Cards Container */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Loading attendance records…</div>
        ) : viewMode === 'daily' ? (
          // Daily Attendance Summary
          dailyRecords.length === 0 ? (
            <div className="py-16 text-center">
              <Calendar className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={40} />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No daily attendance recorded yet.</p>
              <p className="text-xs text-gray-400 mt-1">Attending live classes will automatically mark your attendance here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {dailyRecords.map((d: any) => (
                <div key={d.date} className="p-4 sm:p-5 hover:bg-gray-50/50 dark:hover:bg-white/3 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${d.status === 'PRESENT' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                      {d.status === 'PRESENT' ? '✅' : '❌'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{fmtDate(d.date)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Attended {d.sessionsCount} session{d.sessionsCount > 1 ? 's' : ''} on this day
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${d.status === 'PRESENT' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-700/50' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-700/50'}`}>
                      {d.status === 'PRESENT' ? 'PRESENT (1 Credit)' : 'ABSENT'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Session Details
          records.length === 0 ? (
            <div className="py-16 text-center">
              <Calendar className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={40} />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No session records yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Class</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Joined</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {records.map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-white/3 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white truncate max-w-[220px]">{r.className || r.liveSessionId || 'Live Class'}</p>
                        {r.batchName && <p className="text-xs text-gray-400 truncate">{r.batchName}</p>}
                      </td>
                      <td className="px-4 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(r.joinedAt)}</td>
                      <td className="px-4 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtTime(r.joinedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={r.status || 'PRESENT'} />
                          {r.manuallyMarked && (
                            <span className="text-[10px] text-indigo-500 dark:text-indigo-400">Admin marked</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {r.status === 'ABSENT' && !r.correctionRequested && (
                          <button
                            onClick={() => setCorrectionModal(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-300 dark:border-orange-700/50 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors whitespace-nowrap"
                          >
                            <AlertCircle size={12} />
                            Request Correction
                          </button>
                        )}
                        {r.correctionRequested && (
                          <span className="text-xs text-gray-400 italic">Requested</span>
                        )}
                        {r.status === 'PRESENT' && (
                          <span className="text-xs text-green-500">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Correction Modal */}
      {correctionModal && (
        <CorrectionModal
          record={correctionModal}
          onClose={() => setCorrectionModal(null)}
          onSubmit={(reason) => handleRequestCorrection(correctionModal.id, reason)}
        />
      )}
    </div>
  );
};

export default StudentAttendancePage;
