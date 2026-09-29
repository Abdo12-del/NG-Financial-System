import React, { useState, useEffect } from 'react';
import {
  Layers,
  BookOpen,
  PlusCircle,
  Eye,
  Calendar,
  Percent,
  TrendingUp,
  DollarSign,
  Users
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDate } from '../utils/api';
import Modal from '../components/Modal';

export default function Cohorts() {
  const [activeTab, setActiveTab] = useState('cohorts'); // 'cohorts' or 'courses'
  const [cohorts, setCohorts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add Course Modal
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({ name: '', defaultPrice: '', ageGroup: '', duration: '', description: '' });

  // Add Cohort Modal
  const [isAddCohortOpen, setIsAddCohortOpen] = useState(false);
  const [newCohort, setNewCohort] = useState({
    courseId: '',
    teacherId: '',
    name: '',
    startDate: '',
    endDate: '',
    maxStudents: '20',
    compensationType: 'PERCENTAGE',
    compensationValue: '60'
  });

  // Financial Summary Modal
  const [selectedSummary, setSelectedSummary] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resCohorts, resCourses, resTeachers] = await Promise.all([
        apiRequest('/cohorts/cohorts'),
        apiRequest('/cohorts/courses'),
        apiRequest('/teachers')
      ]);
      setCohorts(resCohorts.cohorts || []);
      setCourses(resCourses.courses || []);
      setTeachers(resTeachers.teachers || []);
    } catch (err) {
      console.error('Error fetching cohorts/courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourse.name) return;
    try {
      await apiRequest('/cohorts/courses', {
        method: 'POST',
        body: JSON.stringify(newCourse)
      });
      setIsAddCourseOpen(false);
      setNewCourse({ name: '', defaultPrice: '', ageGroup: '', duration: '', description: '' });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateCohort = async (e) => {
    e.preventDefault();
    if (!newCohort.courseId || !newCohort.teacherId || !newCohort.name) return;
    try {
      await apiRequest('/cohorts/cohorts', {
        method: 'POST',
        body: JSON.stringify(newCohort)
      });
      setIsAddCohortOpen(false);
      setNewCohort({
        courseId: '',
        teacherId: '',
        name: '',
        startDate: '',
        endDate: '',
        maxStudents: '20',
        compensationType: 'PERCENTAGE',
        compensationValue: '60'
      });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const openFinancialSummary = async (cohortId) => {
    try {
      const summary = await apiRequest(`/cohorts/cohorts/${cohortId}/summary`);
      setSelectedSummary(summary);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl">
          <button
            onClick={() => setActiveTab('cohorts')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'cohorts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الأفواج النشطة ({cohorts.length})
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'courses' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الدورات التدريبية ({courses.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'cohorts' ? (
            <button
              onClick={() => setIsAddCohortOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#38B6FF] hover:bg-[#0BAAFF] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ إنشاء فوج جديد</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddCourseOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#38B6FF] hover:bg-[#0BAAFF] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ إضافة دورة تدريبية</span>
            </button>
          )}
        </div>
      </div>

      {/* Cohorts View */}
      {activeTab === 'cohorts' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                  <th className="py-3 px-4">اسم الفوج</th>
                  <th className="py-3 px-4">الدورة</th>
                  <th className="py-3 px-4">الأستاذ</th>
                  <th className="py-3 px-4">الطلاب المسجلين</th>
                  <th className="py-3 px-4">نظام أجر الأستاذ</th>
                  <th className="py-3 px-4">المحصل</th>
                  <th className="py-3 px-4">المتبقي</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">الملخص المالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-400">
                      جاري تحميل الأفواج...
                    </td>
                  </tr>
                ) : cohorts.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-400">
                      لا توجد أفواج مسجلة بعد
                    </td>
                  </tr>
                ) : (
                  cohorts.map((c) => {
                    const compLabel = c.compensation_type === 'PERCENTAGE'
                      ? `نسبة مئوية (${c.compensation_value}%)`
                      : `مبلغ ثابت (${formatCurrency(c.compensation_value)})`;

                    return (
                      <tr key={c.id} className="hover:bg-sky-50/30 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                        <td className="py-3 px-4 font-semibold text-[#0BAAFF]">{c.course_name}</td>
                        <td className="py-3 px-4 text-slate-700">{c.teacher_name}</td>
                        <td className="py-3 px-4 font-bold">{c.enrolled_students_count || 0} طالب</td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            {compLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-600">{formatCurrency(c.total_collected_revenue)}</td>
                        <td className="py-3 px-4 font-bold text-rose-600">{formatCurrency(c.total_outstanding)}</td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                            {c.status === 'active' ? 'نشط' : c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => openFinancialSummary(c.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#38B6FF]/10 hover:bg-[#38B6FF]/20 text-[#0BAAFF] font-bold rounded-lg text-xs transition cursor-pointer"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>تقرير الربحية</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Courses View */}
      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <div key={course.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 text-sm">{course.name}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-[#0BAAFF]">
                    {course.duration || 'مستمر'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">{course.description || 'لا يوجد وصف مضاف'}</p>

                <div className="space-y-1.5 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between">
                    <span>السعر الافتراضي:</span>
                    <strong className="text-slate-900">{formatCurrency(course.default_price)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>الفئة العمرية:</span>
                    <span>{course.age_group || 'الكل'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>عدد الأفواج:</span>
                    <span>{course.cohort_count || 0} فوج</span>
                  </div>
                </div>
              </div>

              <div className="text-left text-xs font-medium text-slate-400">
                إجمالي الطلاب: {course.student_count || 0}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Course Modal */}
      <Modal
        isOpen={isAddCourseOpen}
        onClose={() => setIsAddCourseOpen(false)}
        title="إضافة دورة تدريبية جديدة"
      >
        <form onSubmit={handleCreateCourse} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-700 mb-1">اسم الدورة *</label>
            <input
              type="text"
              required
              value={newCourse.name}
              onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
              placeholder="مثال: دورة تطوير تطبيقات الويب Fullstack"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">السعر الافتراضي للدورة (دج) *</label>
              <input
                type="number"
                required
                value={newCourse.defaultPrice}
                onChange={(e) => setNewCourse({ ...newCourse, defaultPrice: e.target.value })}
                placeholder="مثال: 4000"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">مدة الدورة</label>
              <input
                type="text"
                value={newCourse.duration}
                onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                placeholder="مثال: 3 أشهر، 40 ساعة..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">الفئة العمرية المستهدفة</label>
            <input
              type="text"
              value={newCourse.ageGroup}
              onChange={(e) => setNewCourse({ ...newCourse, ageGroup: e.target.value })}
              placeholder="مثال: 10-16 سنة، الكبار..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">وصف الدورة</label>
            <textarea
              rows={3}
              value={newCourse.description}
              onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
              placeholder="تفاصيل المنهج والمخرجات..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddCourseOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#38B6FF] hover:bg-[#0BAAFF] text-white font-bold rounded-xl shadow-xs cursor-pointer"
            >
              حفظ الدورة
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Cohort Modal */}
      <Modal
        isOpen={isAddCohortOpen}
        onClose={() => setIsAddCohortOpen(false)}
        title="إنشاء فوج تدريبي جديد وتحديد نظام أجر الأستاذ"
      >
        <form onSubmit={handleCreateCohort} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-700 mb-1">اسم الفوج *</label>
            <input
              type="text"
              required
              value={newCohort.name}
              onChange={(e) => setNewCohort({ ...newCohort, name: e.target.value })}
              placeholder="مثال: فوج برمجة الويب A1"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">الدورة التدريبية *</label>
              <select
                required
                value={newCohort.courseId}
                onChange={(e) => setNewCohort({ ...newCohort, courseId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              >
                <option value="">-- اختر الدورة --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">الأستاذ / المؤطر *</label>
              <select
                required
                value={newCohort.teacherId}
                onChange={(e) => setNewCohort({ ...newCohort, teacherId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              >
                <option value="">-- اختر الأستاذ --</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Teacher Compensation Model per Cohort (Requirement 8) */}
          <div className="p-3.5 bg-sky-50/70 border border-sky-100 rounded-xl space-y-3">
            <span className="font-black text-slate-800 block text-xs">نظام حساب مستحقات الأستاذ لهذا الفوج</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">طريقة الحساب</label>
                <select
                  value={newCohort.compensationType}
                  onChange={(e) => setNewCohort({ ...newCohort, compensationType: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden"
                >
                  <option value="PERCENTAGE">نسبة مئوية من الإيراد (Percentage)</option>
                  <option value="FIXED">مبلغ مقطوع ثابت (Fixed Amount)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {newCohort.compensationType === 'PERCENTAGE' ? 'النسبة المئوية للأستاذ (%)' : 'المبلغ الثابت المستحق (دج)'}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={newCohort.compensationValue}
                  onChange={(e) => setNewCohort({ ...newCohort, compensationValue: e.target.value })}
                  placeholder={newCohort.compensationType === 'PERCENTAGE' ? '60' : '20000'}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black focus:outline-hidden"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              {newCohort.compensationType === 'PERCENTAGE'
                ? `يحصل الأستاذ على ${newCohort.compensationValue || 60}% من كل دفعة يسددها الطالب، وتذهب النسبة المتبقية للأكاديمية.`
                : `عقد ثابت بقيمة ${newCohort.compensationValue || 0} دج لهذا الفوج بصرف النظر عن عدد الطلاب.`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">تاريخ البداية</label>
              <input
                type="date"
                value={newCohort.startDate}
                onChange={(e) => setNewCohort({ ...newCohort, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">تاريخ النهاية</label>
              <input
                type="date"
                value={newCohort.endDate}
                onChange={(e) => setNewCohort({ ...newCohort, endDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddCohortOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#38B6FF] hover:bg-[#0BAAFF] text-white font-bold rounded-xl shadow-xs cursor-pointer"
            >
              إنشاء الفوج
            </button>
          </div>
        </form>
      </Modal>

      {/* Cohort Financial Summary Modal (Requirement 9) */}
      {selectedSummary && (
        <Modal
          isOpen={!!selectedSummary}
          onClose={() => setSelectedSummary(null)}
          title={`الملخص المالي للفوج: ${selectedSummary.cohort.name} (${selectedSummary.cohort.course_name})`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-5 text-xs text-slate-700">
            {/* Header Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block font-medium">قيمة التسجيلات</span>
                <span className="font-bold text-slate-800 text-sm">
                  {formatCurrency(selectedSummary.financials.totalEnrollmentValue)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-emerald-700 block font-medium">المدفوع فعليًا (Revenue)</span>
                <span className="font-black text-emerald-600 text-sm">
                  {formatCurrency(selectedSummary.financials.totalCollected)}
                </span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <span className="text-rose-700 block font-medium">المتبقي على الطلاب</span>
                <span className="font-black text-rose-600 text-sm">
                  {formatCurrency(selectedSummary.financials.totalRemaining)}
                </span>
              </div>
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                <span className="text-sky-700 block font-medium">صافي ربح الأكاديمية</span>
                <span className="font-black text-[#0BAAFF] text-sm">
                  {formatCurrency(selectedSummary.financials.academyNetProfit)}
                </span>
              </div>
            </div>

            {/* Accounting Breakdown */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-800 mb-3">تفصيل توزيع العائدات والتكاليف</h4>

              <div className="flex justify-between py-1.5 border-b border-slate-200 font-semibold">
                <span>الإيراد المحصل من الطلاب (Revenue):</span>
                <strong className="text-emerald-600">{formatCurrency(selectedSummary.financials.totalCollected)}</strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-200">
                <span>حصة الأستاذ ({selectedSummary.cohort.compensation_type === 'PERCENTAGE' ? `${selectedSummary.cohort.compensation_value}%` : 'ثابت'}):</span>
                <strong className="text-rose-600">- {formatCurrency(selectedSummary.financials.teacherTotalShare)}</strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-200">
                <span>المصاريف المباشرة المرتبطة بالفوج (إن وجدت):</span>
                <strong className="text-rose-600">- {formatCurrency(selectedSummary.financials.directExpenses)}</strong>
              </div>

              <div className="flex justify-between py-2 bg-white px-3 rounded-lg border border-slate-200 font-black text-sm">
                <span>صافي ربح الأكاديمية (Academy Net Profit):</span>
                <span className={selectedSummary.financials.academyNetProfit >= 0 ? 'text-[#0BAAFF]' : 'text-rose-600'}>
                  {formatCurrency(selectedSummary.financials.academyNetProfit)} ({selectedSummary.financials.profitMargin})
                </span>
              </div>
            </div>

            {/* Teacher Payment Status for this cohort */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-bold text-amber-900">الأستاذ المؤطر: {selectedSummary.cohort.teacher_name}</p>
                <p className="text-[11px] text-amber-800">
                  صُرف له: {formatCurrency(selectedSummary.financials.teacherPaid)} من أصل {formatCurrency(selectedSummary.financials.teacherTotalShare)}
                </p>
              </div>
              <div className="text-left font-bold">
                <span className="text-xs text-slate-500 block">المتبقي للأستاذ:</span>
                <span className="text-sm font-black text-rose-600">{formatCurrency(selectedSummary.financials.teacherRemainingDue)}</span>
              </div>
            </div>

            {/* Enrolled Students Table */}
            <div>
              <h4 className="font-bold text-slate-800 mb-2">الطلاب المسجلين في هذا الفوج ({selectedSummary.enrollments.length})</h4>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0">
                    <tr>
                      <th className="p-2">الطالب</th>
                      <th className="p-2">المطلوب</th>
                      <th className="p-2">المدفوع</th>
                      <th className="p-2">المتبقي</th>
                      <th className="p-2">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSummary.enrollments.map(e => (
                      <tr key={e.id}>
                        <td className="p-2 font-bold">{e.student_name}</td>
                        <td className="p-2">{formatCurrency(e.net_price)}</td>
                        <td className="p-2 text-emerald-600 font-bold">{formatCurrency(e.paid_amount)}</td>
                        <td className="p-2 text-rose-600 font-bold">{formatCurrency(e.remaining_amount)}</td>
                        <td className="p-2 font-semibold text-[11px]">{e.payment_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedSummary(null)}
                className="px-4 py-2 bg-slate-100 font-bold rounded-xl text-slate-700 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
