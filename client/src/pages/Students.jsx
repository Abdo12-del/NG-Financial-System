import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertCircle,
  PlusCircle,
  Search,
  Download,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  UserPlus,
  BookOpen,
  ChevronLeft,
  Phone,
  ArrowRightLeft
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDate, exportToCsv } from '../utils/api';
import Modal from '../components/Modal';

export default function Students({ onOpenAddPaymentForStudent }) {
  const [activeTab, setActiveTab] = useState('browse');
  const [students, setStudents] = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [courses, setCourses] = useState([]);
  const [totalRemaining, setTotalRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedCohortId, setSelectedCohortId] = useState(null);
  const [hierarchyKey, setHierarchyKey] = useState(0);
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState(new Set());
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferCohortId, setTransferCohortId] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferNotice, setTransferNotice] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [isMonthlyChargeOpen, setIsMonthlyChargeOpen] = useState(false);
  const [monthlyChargeForm, setMonthlyChargeForm] = useState({ month: '', amount: '' });
  const [monthlyChargeError, setMonthlyChargeError] = useState('');
  const [monthlyChargeNotice, setMonthlyChargeNotice] = useState('');
  const [savingMonthlyCharge, setSavingMonthlyCharge] = useState(false);
  const [confirmationNotice, setConfirmationNotice] = useState('');
  const [updatingConfirmationId, setUpdatingConfirmationId] = useState(null);
  const [contactFilter, setContactFilter] = useState('all');
  const [contactTarget, setContactTarget] = useState(null);
  const [contactForm, setContactForm] = useState({
    contactMethod: 'phone',
    status: 'callback',
    note: '',
    nextContactDate: ''
  });
  const [contactError, setContactError] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [contactHistory, setContactHistory] = useState([]);
  const [contactHistoryLoading, setContactHistoryLoading] = useState(false);

  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [cohorts, setCohorts] = useState([]);

  // New Student Form
  const [newStudent, setNewStudent] = useState({
    fullName: '',
    phone: '',
    guardianPhone: '',
    email: '',
    notes: '',
    cohortId: '',
    agreedPrice: '',
    discountAmount: '0'
  });

  const [selectedStudentHistory, setSelectedStudentHistory] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentEditForm, setStudentEditForm] = useState(null);
  const [studentEditError, setStudentEditError] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);
  const [dropTarget, setDropTarget] = useState(null);
  const [dropReason, setDropReason] = useState('');
  const [dropError, setDropError] = useState('');
  const [droppingEnrollment, setDroppingEnrollment] = useState(false);
  const [deleteStudentTarget, setDeleteStudentTarget] = useState(null);
  const [deleteStudentReason, setDeleteStudentReason] = useState('');
  const [deleteStudentError, setDeleteStudentError] = useState('');
  const [deletingStudent, setDeletingStudent] = useState(false);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const [resAll, resOut, resCohorts, resCourses] = await Promise.all([
        apiRequest('/students'),
        apiRequest('/students/outstanding'),
        apiRequest('/cohorts/cohorts'),
        apiRequest('/cohorts/courses')
      ]);
      setStudents(resAll.students || []);
      setOutstanding(resOut.outstanding || []);
      setTotalRemaining(resOut.totalRemaining || 0);
      setCohorts(resCohorts.cohorts || []);
      setCourses(resCourses.courses || []);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateEnrollmentConfirmation = async (student, confirmationStatus) => {
    setUpdatingConfirmationId(String(student.enrollment_id));
    setConfirmationNotice('');
    try {
      const result = await apiRequest(
        `/students/${student.student_id}/enrollments/${student.enrollment_id}/confirmation`,
        {
          method: 'PUT',
          body: JSON.stringify({ confirmationStatus })
        }
      );
      setConfirmationNotice(result.message);
      await fetchStudents();
      if (selectedStudentHistory?.student.id === student.student_id) {
        await openStudentHistory(student.student_id);
      }
    } catch (err) {
      alert(err.message || 'تعذر تحديث حالة التسجيل');
    } finally {
      setUpdatingConfirmationId(null);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.fullName) return;

    try {
      await apiRequest('/students', {
        method: 'POST',
        body: JSON.stringify(newStudent)
      });
      setIsAddStudentOpen(false);
      setNewStudent({
        fullName: '',
        phone: '',
        guardianPhone: '',
        email: '',
        notes: '',
        cohortId: '',
        agreedPrice: '',
        discountAmount: '0'
      });
      fetchStudents();
    } catch (err) {
      alert(err.message);
    }
  };

  const openStudentHistory = async (studentId) => {
    try {
      const data = await apiRequest(`/students/${studentId}`);
      setSelectedStudentHistory(data);
    } catch (err) {
      alert(err.message);
    }
  };

  const openStudentEdit = async (studentId) => {
    try {
      const data = await apiRequest(`/students/${studentId}`);
      setEditingStudent(data.student);
      setStudentEditForm({
        fullName: data.student.full_name || '',
        phone: data.student.phone || '',
        guardianPhone: data.student.guardian_phone || '',
        email: data.student.email || '',
        notes: data.student.notes || ''
      });
      setStudentEditError('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateStudent = async (event) => {
    event.preventDefault();
    if (!studentEditForm?.fullName.trim()) {
      setStudentEditError('اسم الطالب مطلوب');
      return;
    }

    setSavingStudent(true);
    setStudentEditError('');
    try {
      await apiRequest(`/students/${editingStudent.id}`, {
        method: 'PUT',
        body: JSON.stringify(studentEditForm)
      });
      setEditingStudent(null);
      setStudentEditForm(null);
      await fetchStudents();
      if (selectedStudentHistory?.student.id === editingStudent.id) {
        await openStudentHistory(editingStudent.id);
      }
    } catch (err) {
      setStudentEditError(err.message || 'تعذر تحديث بيانات الطالب');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleDropEnrollment = async (event) => {
    event.preventDefault();
    if (!dropTarget || !dropReason.trim()) {
      setDropError('يرجى كتابة سبب إزالة التسجيل');
      return;
    }

    setDroppingEnrollment(true);
    setDropError('');
    try {
      await apiRequest(`/students/${dropTarget.studentId}/enrollments/${dropTarget.enrollmentId}/drop`, {
        method: 'POST',
        body: JSON.stringify({ reason: dropReason.trim() })
      });
      setDropTarget(null);
      setDropReason('');
      await fetchStudents();
      if (selectedStudentHistory?.student.id === dropTarget.studentId) {
        await openStudentHistory(dropTarget.studentId);
      }
    } catch (err) {
      setDropError(err.message || 'تعذر إزالة تسجيل الطالب');
    } finally {
      setDroppingEnrollment(false);
    }
  };

  const handleDeleteStudent = async (event) => {
    event.preventDefault();
    if (!deleteStudentTarget || !deleteStudentReason.trim()) {
      setDeleteStudentError('يرجى كتابة سبب حذف ملف الطالب');
      return;
    }

    setDeletingStudent(true);
    setDeleteStudentError('');
    try {
      await apiRequest(`/students/${deleteStudentTarget.studentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: deleteStudentReason.trim() })
      });
      setDeleteStudentTarget(null);
      setDeleteStudentReason('');
      await fetchStudents();
    } catch (err) {
      setDeleteStudentError(err.message || 'تعذر حذف ملف الطالب');
    } finally {
      setDeletingStudent(false);
    }
  };

  const displayedList = activeTab === 'outstanding' ? outstanding : students;
  const filteredList = displayedList.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return s.full_name?.toLowerCase().includes(term) || s.phone?.includes(term);
  });
  const selectedCourse = courses.find(course => String(course.id) === String(selectedCourseId));
  const selectedCohort = cohorts.find(cohort => String(cohort.id) === String(selectedCohortId));
  const courseCohorts = selectedCourseId
    ? cohorts.filter(cohort => String(cohort.course_id) === String(selectedCourseId))
    : [];
  const hierarchyStudents = selectedCohortId === 'unassigned'
    ? filteredList.filter(student => !student.cohort_id)
    : selectedCohortId
      ? filteredList.filter(student => String(student.cohort_id) === String(selectedCohortId))
      : [];
  const tableStudents = activeTab === 'browse' ? hierarchyStudents : filteredList;
  const selectedTableStudents = tableStudents.filter(student => selectedEnrollmentIds.has(String(student.enrollment_id)));
  const selectedChargeEligibleStudents = selectedTableStudents.filter(student => student.confirmation_status === 'confirmed');
  const transferCourseId = selectedTableStudents[0]?.course_id;
  const excludedCohortIds = new Set(selectedTableStudents.map(student => String(student.cohort_id)));
  const transferCohorts = cohorts.filter(cohort =>
    String(cohort.course_id) === String(transferCourseId)
    && cohort.status === 'active'
    && !excludedCohortIds.has(String(cohort.id))
  );
  const availableTransferCohorts = transferCohorts.filter(cohort =>
    Number(cohort.max_students) <= 0
    || Number(cohort.max_students) - Number(cohort.enrolled_students_count || 0) >= selectedTableStudents.length
  );
  const selectableCourseId = transferCourseId || tableStudents.find(student => student.enrollment_id)?.course_id;
  const selectableStudents = tableStudents.filter(student =>
    student.enrollment_id && String(student.course_id) === String(selectableCourseId)
  );
  const allSelectableStudentsSelected = selectableStudents.length > 0
    && selectableStudents.every(student => selectedEnrollmentIds.has(String(student.enrollment_id)));
  const contactStatusOptions = [
    { value: 'all', label: 'كل الحالات' },
    { value: 'callback', label: 'إعادة الاتصال' },
    { value: 'no_answer', label: 'لم يرد' },
    { value: 'awaiting_payment', label: 'بانتظار المستحقات' },
    { value: 'confirmed', label: 'أكد التسجيل' },
    { value: 'not_interested', label: 'غير مهتم' }
  ];
  const contactStatusLabel = value => contactStatusOptions.find(option => option.value === value)?.label || 'غير محدد';
  const uniqueStudents = [...new Map(students.map(student => [student.student_id, student])).values()];
  const contactStudents = uniqueStudents.filter(student =>
    (contactFilter === 'all' || student.contact_status === contactFilter)
    && (!searchTerm || student.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      || student.phone?.includes(searchTerm) || student.guardian_phone?.includes(searchTerm))
  );

  const goToCourses = () => {
    setSelectedEnrollmentIds(new Set());
    setSelectedCourseId(null);
    setSelectedCohortId(null);
    setHierarchyKey(key => key + 1);
  };
  const openCourse = courseId => {
    setSelectedEnrollmentIds(new Set());
    setSelectedCourseId(courseId);
    setSelectedCohortId(null);
    setHierarchyKey(key => key + 1);
  };
  const openCohort = cohortId => {
    setSelectedEnrollmentIds(new Set());
    setSelectedCohortId(cohortId);
    setHierarchyKey(key => key + 1);
  };

  const toggleEnrollmentSelection = (student, checked) => {
    setSelectedEnrollmentIds(current => {
      const next = new Set(current);
      if (checked) next.add(String(student.enrollment_id));
      else next.delete(String(student.enrollment_id));
      return next;
    });
  };

  const toggleAllVisibleEnrollments = checked => {
    setSelectedEnrollmentIds(current => {
      const next = new Set(current);
      const currentCourseId = selectedTableStudents[0]?.course_id || tableStudents.find(student => student.enrollment_id)?.course_id;
      tableStudents.forEach(student => {
        if (!student.enrollment_id || (currentCourseId && String(student.course_id) !== String(currentCourseId))) return;
        if (checked) next.add(String(student.enrollment_id));
        else next.delete(String(student.enrollment_id));
      });
      return next;
    });
  };

  const handleBulkTransfer = async event => {
    event.preventDefault();
    if (!transferCohortId || selectedTableStudents.length === 0) {
      setTransferError('يرجى تحديد الطلاب والفوج المستهدف');
      return;
    }
    setTransferring(true);
    setTransferError('');
    try {
      const targetCohortId = transferCohortId;
      const result = await apiRequest('/students/enrollments/transfer', {
        method: 'PUT',
        body: JSON.stringify({
          enrollmentIds: selectedTableStudents.map(student => student.enrollment_id),
          cohortId: Number(transferCohortId)
        })
      });
      setIsTransferOpen(false);
      setTransferCohortId('');
      setSelectedEnrollmentIds(new Set());
      setTransferNotice(result.message || 'تم نقل الطلاب بنجاح');
      if (activeTab === 'browse') {
        setSelectedCohortId(targetCohortId);
        setHierarchyKey(key => key + 1);
      }
      await fetchStudents();
      if (selectedStudentHistory && selectedTableStudents.some(student => String(student.student_id) === String(selectedStudentHistory.student.id))) {
        setSelectedStudentHistory(null);
      }
    } catch (err) {
      setTransferError(err.message || 'تعذر نقل الطلاب');
    } finally {
      setTransferring(false);
    }
  };

  const handleBulkMonthlyCharge = async event => {
    event.preventDefault();
    if (!selectedCohortId || selectedTableStudents.length === 0) {
      setMonthlyChargeError('يرجى تحديد طلاب من الفوج أولًا');
      return;
    }

    setSavingMonthlyCharge(true);
    setMonthlyChargeError('');
    try {
      const result = await apiRequest(`/cohorts/cohorts/${selectedCohortId}/monthly-charges`, {
        method: 'POST',
        body: JSON.stringify({
          enrollmentIds: selectedTableStudents.map(student => student.enrollment_id),
          month: monthlyChargeForm.month,
          amount: monthlyChargeForm.amount
        })
      });
      setIsMonthlyChargeOpen(false);
      setSelectedEnrollmentIds(new Set());
      setMonthlyChargeNotice(result.message);
      await fetchStudents();
    } catch (err) {
      setMonthlyChargeError(err.message || 'تعذرت إضافة المستحقات الشهرية');
    } finally {
      setSavingMonthlyCharge(false);
    }
  };

  const openContactFollowup = async student => {
    setContactTarget(student);
    setContactForm({
      contactMethod: 'phone',
      status: student.contact_status && student.contact_status !== 'none' ? student.contact_status : 'callback',
      note: '',
      nextContactDate: ''
    });
    setContactError('');
    setContactHistory([]);
    setContactHistoryLoading(true);
    try {
      const result = await apiRequest(`/students/${student.student_id}/contact-followups`);
      setContactHistory(result.followups || []);
    } catch (err) {
      setContactError(err.message || 'تعذر تحميل سجل المتابعة');
    } finally {
      setContactHistoryLoading(false);
    }
  };

  const saveContactFollowup = async event => {
    event.preventDefault();
    if (!contactTarget) return;
    setSavingContact(true);
    setContactError('');
    try {
      await apiRequest(`/students/${contactTarget.student_id}/contact-followups`, {
        method: 'POST',
        body: JSON.stringify(contactForm)
      });
      setContactTarget(null);
      await fetchStudents();
    } catch (err) {
      setContactError(err.message || 'تعذر حفظ المتابعة');
    } finally {
      setSavingContact(false);
    }
  };

  const handleExport = () => {
    const headers = ['اسم الطالب', 'الهاتف', 'الدورة / الفوج', 'السعر المتفق عليه', 'المدفوع', 'المتبقي', 'حالة الدفع', 'آخر تاريخ دفع'];
    const rows = filteredList.map(s => [
      s.full_name,
      s.phone || '-',
      s.cohort_name ? `${s.course_name} - ${s.cohort_name}` : '-',
      s.confirmation_status === 'pending' ? 'بانتظار التأكيد' : s.net_price || 0,
      s.paid_amount || 0,
      s.confirmation_status === 'pending' ? '-' : s.remaining_amount || 0,
      s.confirmation_status === 'pending' ? 'بانتظار التأكيد' : s.payment_status || 'UNPAID',
      s.last_payment_date || '-'
    ]);
    exportToCsv(`students_${activeTab}_${Date.now()}`, headers, rows);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
          <button
            onClick={() => {
              setSelectedEnrollmentIds(new Set());
              setActiveTab('browse');
              goToCourses();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'browse' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الدورات والأفواج ({courses.length})
          </button>
          <button
            onClick={() => {
              setSelectedEnrollmentIds(new Set());
              setActiveTab('followups');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'followups' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            متابعة الطلاب ({uniqueStudents.filter(student => student.contact_status && student.contact_status !== 'none').length})
          </button>
          <button
            onClick={() => {
              setSelectedEnrollmentIds(new Set());
              setActiveTab('outstanding');
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'outstanding' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>المبالغ المستحقة ({outstanding.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'outstanding' && (
            <div className="text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 px-3.5 py-2 rounded-xl">
              إجمالي المبالغ غير المحصلة: <span className="font-black text-rose-600">{formatCurrency(totalRemaining)}</span>
            </div>
          )}

          {(activeTab === 'outstanding' || activeTab === 'followups' || selectedCohortId) && (
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>تصدير CSV</span>
            </button>
          )}

          <button
            onClick={() => setIsAddStudentOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#38B6FF] hover:bg-[#0BAAFF] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ تسجيل طالب جديد</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedEnrollmentIds(new Set());
            }}
            placeholder={activeTab === 'browse' && !selectedCohortId ? 'ابحث عن دورة أو فوج أو طالب...' : 'بحث بالاسم أو رقم الهاتف...'}
            className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </div>
      </div>

      {activeTab === 'browse' && (
        <section key={`hierarchy-${hierarchyKey}`} className="space-y-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button onClick={goToCourses} className={`font-black transition hover:text-sky-600 ${selectedCourseId ? 'text-sky-700' : 'text-slate-900'}`}>
                الدورات
              </button>
              {selectedCourse && (
                <>
                  <ChevronLeft className="h-4 w-4 text-slate-400" />
                  <button
                    onClick={() => {
                      setSelectedCohortId(null);
                      setHierarchyKey(key => key + 1);
                    }}
                    className={`font-black transition hover:text-sky-600 ${selectedCohortId ? 'text-sky-700' : 'text-slate-900'}`}
                  >
                    {selectedCourse.name}
                  </button>
                </>
              )}
              {selectedCohortId === 'unassigned' && (
                <>
                  <ChevronLeft className="h-4 w-4 text-slate-400" />
                  <span className="font-black text-slate-900">طلاب دون فوج</span>
                </>
              )}
              {selectedCohort && (
                <>
                  <ChevronLeft className="h-4 w-4 text-slate-400" />
                  <span className="font-black text-slate-900">{selectedCohort.name}</span>
                </>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {selectedCohort ? 'قائمة طلاب الفوج' : selectedCourse ? 'اختر فوجًا لعرض طلابه' : 'اختر دورة لعرض أفواجها وطلابها'}
            </p>
          </div>

          {!selectedCourseId && !selectedCohortId && (
            <>
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">جارٍ تحميل الدورات...</div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {courses.filter(course => !searchTerm || course.name?.toLowerCase().includes(searchTerm.toLowerCase())).map((course) => {
                    const courseGroups = cohorts.filter(cohort => String(cohort.course_id) === String(course.id));
                    const enrolledCount = students.filter(student => courseGroups.some(cohort => String(cohort.id) === String(student.cohort_id)))
                      .reduce((ids, student) => ids.add(student.student_id), new Set()).size;
                    return (
                      <button
                        key={course.id}
                        onClick={() => openCourse(course.id)}
                        className="group rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                            <BookOpen className="h-5 w-5" />
                          </span>
                          <ChevronLeft className="mt-1 h-5 w-5 text-slate-300 transition-colors group-hover:text-sky-600" />
                        </div>
                        <div className="mt-5">
                          <h2 className="text-base font-bold text-slate-900">{course.name}</h2>
                          <p className="mt-1 text-xs text-slate-500">{course.age_group || 'دورة تدريبية'}{course.duration ? ` · ${course.duration}` : ''}</p>
                        </div>
                        <div className="mt-5 flex items-center gap-2">
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">{courseGroups.length} فوج</span>
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">{enrolledCount} طالب</span>
                        </div>
                      </button>
                    );
                  })}
                  {students.some(student => !student.cohort_id)
                    && (!searchTerm || students.some(student => !student.cohort_id && student.full_name?.toLowerCase().includes(searchTerm.toLowerCase())))
                    && (
                      <button
                        onClick={() => openCohort('unassigned')}
                        className="group rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Users className="h-5 w-5" /></span>
                        <h2 className="mt-5 text-base font-bold text-slate-900">طلاب دون فوج</h2>
                        <p className="mt-1 text-xs text-slate-500">طلاب لديهم ملفات ولم يُربطوا بفوج بعد</p>
                      </button>
                    )}
                  {courses.length === 0 && !students.some(student => !student.cohort_id) && (
                    <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">لا توجد دورات أو طلاب للعرض حاليًا.</div>
                  )}
                  {courses.length > 0 && courses.filter(course => !searchTerm || course.name?.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                    <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">لا توجد دورات تطابق البحث.</div>
                  )}
                </div>
              )}
            </>
          )}

          {selectedCourseId && !selectedCohortId && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {courseCohorts
                .filter(cohort => !searchTerm || cohort.name?.toLowerCase().includes(searchTerm.toLowerCase()) || cohort.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((cohort) => (
                  <button
                    key={cohort.id}
                    onClick={() => openCohort(cohort.id)}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                        <Users className="h-5 w-5" />
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${cohort.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {cohort.status === 'active' ? 'نشط' : 'قادم'}
                      </span>
                    </div>
                    <h2 className="mt-5 text-base font-bold text-slate-900">{cohort.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">الأستاذ: {cohort.teacher_name || 'غير محدد'}</p>
                    <div className="mt-5 flex items-center justify-between text-xs">
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700">
                        {cohort.enrolled_students_count || 0} / {cohort.max_students || 0} طالب
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-sky-700">عرض الطلاب <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /></span>
                    </div>
                  </button>
                ))}
              {courseCohorts.length === 0 && <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">لا توجد أفواج لهذه الدورة بعد.</div>}
            </div>
          )}
        </section>
      )}

      {activeTab === 'followups' && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {contactStatusOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setContactFilter(option.value)}
                className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all ${contactFilter === option.value ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'border border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-violet-200'}`}
              >
                {option.label}{' '}
                <span className="opacity-70">
                  {option.value === 'all'
                    ? uniqueStudents.length
                    : uniqueStudents.filter(student => student.contact_status === option.value).length}
                </span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <div className="col-span-full rounded-2xl bg-white p-10 text-center text-sm text-slate-400">جارٍ تحميل قوائم المتابعة...</div>
            ) : contactStudents.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">لا يوجد طلاب بهذه الحالة. افتح ملف الطالب وسجّل نتيجة التواصل لتظهر هنا.</div>
            ) : contactStudents.map((student) => (
              <article
                key={student.student_id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-sky-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-900">{student.full_name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{student.cohort_name || 'دون فوج'} · {student.course_name || 'دون دورة'}</p>
                  </div>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700">{contactStatusLabel(student.contact_status)}</span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    {student.next_contact_date ? `المتابعة: ${formatDate(student.next_contact_date)}` : 'لا يوجد موعد قادم'}
                  </span>
                  <button onClick={() => openContactFollowup(student)} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                    تحديث المتابعة
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Students Table */}
      {(activeTab === 'outstanding' || (activeTab === 'browse' && selectedCohortId)) && (
      <div className="space-y-3">
      {transferNotice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          <span>{transferNotice}</span>
          <button type="button" onClick={() => setTransferNotice('')} className="text-xs font-bold text-emerald-700 hover:text-emerald-900">إغلاق</button>
        </div>
      )}
      {monthlyChargeNotice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          <span>{monthlyChargeNotice}</span>
          <button type="button" onClick={() => setMonthlyChargeNotice('')} className="text-xs font-bold text-emerald-700 hover:text-emerald-900">إغلاق</button>
        </div>
      )}
      {confirmationNotice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          <span>{confirmationNotice}</span>
          <button type="button" onClick={() => setConfirmationNotice('')} className="text-xs font-bold text-emerald-700 hover:text-emerald-900">إغلاق</button>
        </div>
      )}
      {selectedTableStudents.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <div className="text-sm font-bold text-slate-700">
            تم تحديد {selectedTableStudents.length} طالب
            <span className="mr-2 text-xs font-medium text-slate-500">
              {selectedCohort ? 'اختر إجراءً على الطلاب المحددين' : 'يمكن نقل طلاب الدورة نفسها فقط'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'browse' && selectedCohort && (
              <button
                type="button"
                onClick={() => {
                  setMonthlyChargeError('');
                  setMonthlyChargeNotice('');
                  const now = new Date();
                  setMonthlyChargeForm({
                    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
                    amount: ''
                  });
                  setIsMonthlyChargeOpen(true);
                }}
                disabled={selectedChargeEligibleStudents.length !== selectedTableStudents.length}
                title={selectedChargeEligibleStudents.length !== selectedTableStudents.length
                  ? 'أكد التسجيلات أو أعد تفعيلها قبل إضافة المستحقات'
                  : ''}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlusCircle className="h-4 w-4" />
                إضافة مستحق شهري
              </button>
            )}
            {activeTab === 'browse' && selectedCohort && selectedChargeEligibleStudents.length !== selectedTableStudents.length && (
              <span className="text-[11px] font-semibold text-amber-700">
                لا تُضاف المستحقات إلا للتسجيلات المؤكدة ({selectedChargeEligibleStudents.length}/{selectedTableStudents.length})
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setTransferError('');
                setTransferNotice('');
                setTransferCohortId('');
                setIsTransferOpen(true);
              }}
              disabled={transferCohorts.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowRightLeft className="h-4 w-4" />
              نقل إلى فوج آخر
            </button>
            <button
              type="button"
              onClick={() => setSelectedEnrollmentIds(new Set())}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                <th className="py-3 px-3 text-center">
                  <input
                    type="checkbox"
                    aria-label="تحديد الطلاب الظاهرين من الدورة نفسها"
                    checked={allSelectableStudentsSelected}
                    onChange={event => toggleAllVisibleEnrollments(event.target.checked)}
                    className="h-4 w-4 accent-sky-600"
                  />
                </th>
                <th className="py-3 px-4">الطالب</th>
                <th className="py-3 px-4">رقم الهاتف</th>
                <th className="py-3 px-4">الفوج والدورة</th>
                <th className="py-3 px-4">سعر الدورة</th>
                <th className="py-3 px-4">المدفوع</th>
                <th className="py-3 px-4">المتبقي</th>
                <th className="py-3 px-4">حالة الدفع</th>
                <th className="py-3 px-4">آخر دفعة</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-slate-400">
                    جاري تحميل قائمة الطلاب...
                  </td>
                </tr>
              ) : tableStudents.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-slate-400">
                    لا يوجد طلاب يطابقون شروط البحث
                  </td>
                </tr>
              ) : (
                tableStudents.map((s) => {
                  const isPending = s.confirmation_status === 'pending';
                  const remaining = isPending ? 0 : parseFloat(s.remaining_amount || 0);
                  const paid = parseFloat(s.paid_amount || 0);
                  const net = isPending ? 0 : parseFloat(s.net_price || 0);

                  let statusBadge = (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                      لم يدفع
                    </span>
                  );
                  if (remaining <= 0 && net > 0) {
                    statusBadge = (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        مدفوع بالكامل
                      </span>
                    );
                  } else if (paid > 0 && remaining > 0) {
                    statusBadge = (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        دفع جزئي
                      </span>
                    );
                  }
                  if (isPending) {
                    statusBadge = (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        بانتظار التأكيد — لا توجد مستحقات
                      </span>
                    );
                  }

                  return (
                    <tr key={`${s.student_id}-${s.enrollment_id || 'unassigned'}`} className="hover:bg-sky-50/30 transition-colors">
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`تحديد ${s.full_name} للنقل`}
                          checked={Boolean(s.enrollment_id && selectedEnrollmentIds.has(String(s.enrollment_id)))}
                          disabled={!s.enrollment_id || String(s.course_id) !== String(selectableCourseId)}
                          onChange={event => toggleEnrollmentSelection(s, event.target.checked)}
                          className="h-4 w-4 accent-sky-600 disabled:cursor-not-allowed disabled:opacity-30"
                        />
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {s.full_name}
                        {s.contact_status && s.contact_status !== 'none' && (
                          <span className="mt-1 block w-fit rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-black text-violet-700">
                            {contactStatusLabel(s.contact_status)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">{s.phone || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {s.cohort_name ? `${s.cohort_name} (${s.course_name})` : 'غير مسجل'}
                      </td>
                      <td className="py-3 px-4 font-semibold">{isPending ? '—' : formatCurrency(net)}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">{formatCurrency(paid)}</td>
                      <td className="py-3 px-4 font-extrabold text-rose-600">{isPending ? '—' : formatCurrency(remaining)}</td>
                      <td className="py-3 px-4">{statusBadge}</td>
                      <td className="py-3 px-4 text-slate-500">{s.last_payment_date || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {s.enrollment_id && s.confirmation_status !== 'pending' && (
                            <span
                              className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                                s.confirmation_status === 'frozen'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {s.confirmation_status === 'frozen' ? 'مجمّد' : 'مؤكد'}
                            </span>
                          )}
                          {s.enrollment_id && (
                            <button
                              type="button"
                              disabled={updatingConfirmationId === String(s.enrollment_id)}
                              onClick={() => updateEnrollmentConfirmation(
                                s,
                                s.confirmation_status === 'confirmed' ? 'frozen' : 'confirmed'
                              )}
                              title={s.confirmation_status === 'pending'
                                ? 'تأكيد التسجيل وبدء المستحقات من هذا الشهر'
                                : s.confirmation_status === 'frozen'
                                  ? 'إعادة تفعيل التسجيل وبدء المستحقات من هذا الشهر'
                                  : 'تجميد التسجيل وإيقاف المستحقات الشهرية الجديدة'}
                              className={`rounded-lg px-2 py-1 text-[10px] font-bold transition disabled:cursor-wait disabled:opacity-50 ${
                                s.confirmation_status === 'confirmed'
                                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                              }`}
                            >
                              {updatingConfirmationId === String(s.enrollment_id)
                                ? 'جارٍ التحديث...'
                                : s.confirmation_status === 'pending'
                                  ? 'تأكيد'
                                  : s.confirmation_status === 'frozen'
                                    ? 'إعادة تفعيل'
                                    : 'تجميد'}
                            </button>
                          )}
                          <button
                            onClick={() => openStudentEdit(s.student_id)}
                            title="تعديل بيانات الطالب"
                            aria-label={`تعديل بيانات الطالب ${s.full_name}`}
                            className="p-1 hover:bg-sky-50 rounded-md text-slate-500 hover:text-sky-700 transition cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {!s.has_enrollment_history && !s.has_payment_history && (
                            <button
                              onClick={() => {
                                setDeleteStudentTarget({ studentId: s.student_id, studentName: s.full_name });
                                setDeleteStudentReason('');
                                setDeleteStudentError('');
                              }}
                              title="حذف ملف طالب لم يُسجل مطلقًا"
                              aria-label={`حذف ملف الطالب ${s.full_name}`}
                              className="p-1 hover:bg-rose-50 rounded-md text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {s.enrollment_id && (
                            <button
                              onClick={() => {
                                setDropTarget({
                                  studentId: s.student_id,
                                  enrollmentId: s.enrollment_id,
                                  studentName: s.full_name,
                                  cohortName: s.cohort_name,
                                  courseName: s.course_name
                                });
                                setDropReason('');
                                setDropError('');
                              }}
                              title="إزالة هذا التسجيل فقط"
                              aria-label={`إزالة تسجيل ${s.full_name} من ${s.cohort_name}`}
                              className="p-1 hover:bg-rose-50 rounded-md text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {remaining > 0 && (
                            <button
                              onClick={() => onOpenAddPaymentForStudent?.(s.student_id, s.cohort_id)}
                              title="تسجيل دفعة لهذا الطالب"
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] transition cursor-pointer"
                            >
                              + دفع قسط
                            </button>
                          )}
                          <button
                            onClick={() => openStudentHistory(s.student_id)}
                            title="الملف وسجل الدفعات"
                            className="p-1 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      )}

      {contactTarget && (
        <Modal
          isOpen={Boolean(contactTarget)}
          onClose={() => setContactTarget(null)}
          title={`متابعة الطالب — ${contactTarget.full_name}`}
        >
          <div className="mb-5 max-h-44 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
            <h3 className="text-xs font-black text-slate-700">سجل التواصل السابق</h3>
            {contactHistoryLoading ? (
              <p className="text-xs text-slate-400">جارٍ تحميل السجل...</p>
            ) : contactHistory.length === 0 ? (
              <p className="text-xs text-slate-400">لا توجد متابعات سابقة لهذا الطالب.</p>
            ) : contactHistory.map(item => (
              <div key={item.id} className="border-r-2 border-violet-200 pr-3">
                <p className="text-[10px] font-bold text-slate-500">
                  {formatDate(item.contacted_at)} · {contactStatusLabel(item.status)}
                </p>
                {item.note && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{item.note}</p>}
                {item.next_contact_date && <p className="mt-1 text-[10px] text-violet-700">موعد المتابعة: {formatDate(item.next_contact_date)}</p>}
              </div>
            ))}
          </div>
          <form onSubmit={saveContactFollowup} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">وسيلة التواصل</span>
                <select value={contactForm.contactMethod} onChange={event => setContactForm({ ...contactForm, contactMethod: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  <option value="phone">مكالمة هاتفية</option>
                  <option value="whatsapp">واتساب</option>
                  <option value="telegram">تلغرام</option>
                  <option value="in_person">حضوري</option>
                  <option value="other">أخرى</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">نتيجة المتابعة</span>
                <select value={contactForm.status} onChange={event => setContactForm({ ...contactForm, status: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  {contactStatusOptions.filter(option => option.value !== 'all').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">موعد المتابعة القادم</span>
                <input type="date" value={contactForm.nextContactDate} onChange={event => setContactForm({ ...contactForm, nextContactDate: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">ملاحظات التواصل</span>
              <textarea value={contactForm.note} onChange={event => setContactForm({ ...contactForm, note: event.target.value })} rows="3" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            {contactError && <p role="alert" className="text-xs font-bold text-rose-600">{contactError}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setContactTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">إلغاء</button>
              <button type="submit" disabled={savingContact} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{savingContact ? 'جارٍ الحفظ...' : 'حفظ المتابعة'}</button>
            </div>
          </form>
        </Modal>
      )}
      <Modal
        isOpen={isTransferOpen}
        onClose={() => {
          if (!transferring) {
            setIsTransferOpen(false);
            setTransferError('');
          }
        }}
        title={`نقل ${selectedTableStudents.length} طالب إلى فوج آخر`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleBulkTransfer} className="space-y-4 text-sm">
          <p className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-6 text-sky-900">
            سيبقى سجل الطالب والدفعات والمبالغ كما هو، وسيتم نقل ارتباط التسجيل إلى الفوج الجديد ضمن الدورة نفسها.
          </p>
          <div>
            <label htmlFor="transfer-cohort" className="mb-1.5 block text-xs font-bold text-slate-700">الفوج المستهدف</label>
            <select
              id="transfer-cohort"
              required
              value={transferCohortId}
              onChange={event => setTransferCohortId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
            >
              <option value="">اختر الفوج</option>
              {transferCohorts.map(cohort => {
                const seatsLeft = Number(cohort.max_students || 0) - Number(cohort.enrolled_students_count || 0);
                return (
                  <option
                    key={cohort.id}
                    value={cohort.id}
                    disabled={Number(cohort.max_students) > 0 && seatsLeft < selectedTableStudents.length}
                  >
                    {cohort.name} · {cohort.enrolled_students_count || 0}/{cohort.max_students || '∞'} طالب
                    {Number(cohort.max_students) > 0 ? ` · متاح ${Math.max(0, seatsLeft)}` : ''}
                  </option>
                );
              })}
            </select>
            {transferCohorts.length === 0 ? (
              <p className="mt-2 text-xs text-amber-700">لا توجد أفواج نشطة أخرى متاحة لهذه الدورة.</p>
            ) : availableTransferCohorts.length === 0 ? (
              <p className="mt-2 text-xs text-amber-700">لا توجد مقاعد كافية في الأفواج النشطة لاستيعاب جميع الطلاب المحددين.</p>
            ) : null}
          </div>
          {transferError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{transferError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={transferring}
              onClick={() => setIsTransferOpen(false)}
              className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={transferring || availableTransferCohorts.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {transferring ? 'جارٍ النقل...' : 'تأكيد نقل الطلاب'}
            </button>
          </div>
        </form>
      </Modal>

      {deleteStudentTarget && (
        <Modal
          isOpen={!!deleteStudentTarget}
          onClose={() => {
            setDeleteStudentTarget(null);
            setDeleteStudentReason('');
            setDeleteStudentError('');
          }}
          title="حذف ملف طالب غير مسجل"
        >
          <form onSubmit={handleDeleteStudent} className="space-y-4 text-xs text-slate-700">
            {deleteStudentError && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">
                {deleteStudentError}
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-bold text-slate-900">{deleteStudentTarget.studentName}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 leading-relaxed text-amber-900">
              سيُحذف ملف الطالب نهائيًا لأنه بلا تسجيلات أو دفعات. إذا ظهر له أي سجل مالي، سيرفض النظام الحذف لحماية البيانات.
            </div>
            <label className="block font-bold">
              سبب حذف الملف *
              <textarea
                rows={3}
                required
                value={deleteStudentReason}
                onChange={(event) => setDeleteStudentReason(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setDeleteStudentTarget(null)}
                className="rounded-lg px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={deletingStudent}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deletingStudent ? 'جارٍ الحذف...' : 'حذف ملف الطالب'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dropTarget && (
        <Modal
          isOpen={!!dropTarget}
          onClose={() => {
            setDropTarget(null);
            setDropReason('');
            setDropError('');
          }}
          title="إزالة تسجيل من فوج"
        >
          <form onSubmit={handleDropEnrollment} className="space-y-4 text-xs text-slate-700">
            {dropError && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">
                {dropError}
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-bold text-slate-900">{dropTarget.studentName}</p>
              <p className="mt-1 text-slate-600">{dropTarget.cohortName} ({dropTarget.courseName})</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 leading-relaxed text-sky-900">
              سيتم استبعاد هذا التسجيل فقط. سيبقى ملف الطالب وأي تسجيلات أخرى محفوظة. لا يمكن تنفيذ الإزالة ما دامت هناك دفعة فعّالة مرتبطة بهذا الفوج.
            </div>
            <label className="block font-bold">
              سبب إزالة التسجيل *
              <textarea
                rows={3}
                required
                value={dropReason}
                onChange={(event) => setDropReason(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setDropTarget(null)}
                className="rounded-lg px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={droppingEnrollment}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {droppingEnrollment ? 'جارٍ الإزالة...' : 'إزالة هذا التسجيل'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        title="تسجيل طالب جديد في الأكاديمية"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-700 mb-1">اسم الطالب الكامل *</label>
            <input
              type="text"
              required
              value={newStudent.fullName}
              onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
              placeholder="مثال: محمد بن علي"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
              <input
                type="text"
                value={newStudent.phone}
                onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                placeholder="05 / 06 / 07..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">هاتف الولي (للأطفال/الناشئة)</label>
              <input
                type="text"
                value={newStudent.guardianPhone}
                onChange={(e) => setNewStudent({ ...newStudent, guardianPhone: e.target.value })}
                placeholder="هاتف ولي الأمر..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">تسجيل مباشر في فوج (اختياري)</label>
            <select
              value={newStudent.cohortId}
              onChange={(e) => {
                const cId = e.target.value;
                const found = cohorts.find(c => String(c.id) === String(cId));
                setNewStudent({
                  ...newStudent,
                  cohortId: cId,
                  agreedPrice: found ? found.course_default_price : ''
                });
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            >
              <option value="">-- اختر الفوج إن أردت تسجيله الآن --</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name} - {c.course_name} ({formatCurrency(c.course_default_price)})</option>
              ))}
            </select>
          </div>

          {newStudent.cohortId && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">السعر المتفق عليه (دج)</label>
                <input
                  type="number"
                  value={newStudent.agreedPrice}
                  onChange={(e) => setNewStudent({ ...newStudent, agreedPrice: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">الخصم / التخفيض (إن وجد)</label>
                <input
                  type="number"
                  value={newStudent.discountAmount}
                  onChange={(e) => setNewStudent({ ...newStudent, discountAmount: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddStudentOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#38B6FF] hover:bg-[#0BAAFF] text-white font-bold rounded-xl shadow-xs cursor-pointer"
            >
              حفظ الطالب
            </button>
          </div>
        </form>
      </Modal>

      {editingStudent && studentEditForm && (
        <Modal
          isOpen={!!editingStudent}
          onClose={() => {
            setEditingStudent(null);
            setStudentEditForm(null);
            setStudentEditError('');
          }}
          title={`تعديل بيانات الطالب: ${editingStudent.full_name}`}
        >
          <form onSubmit={handleUpdateStudent} className="space-y-4 text-xs text-slate-700">
            {studentEditError && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">
                {studentEditError}
              </div>
            )}
            <label className="block font-bold">
              الاسم الكامل *
              <input
                required
                value={studentEditForm.fullName}
                onChange={(event) => setStudentEditForm({ ...studentEditForm, fullName: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block font-bold">
                رقم الهاتف
                <input
                  value={studentEditForm.phone}
                  onChange={(event) => setStudentEditForm({ ...studentEditForm, phone: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
                />
              </label>
              <label className="block font-bold">
                هاتف الولي
                <input
                  value={studentEditForm.guardianPhone}
                  onChange={(event) => setStudentEditForm({ ...studentEditForm, guardianPhone: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
                />
              </label>
            </div>
            <label className="block font-bold">
              البريد الإلكتروني
              <input
                type="email"
                value={studentEditForm.email}
                onChange={(event) => setStudentEditForm({ ...studentEditForm, email: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
              />
            </label>
            <label className="block font-bold">
              ملاحظات
              <textarea
                rows={3}
                value={studentEditForm.notes}
                onChange={(event) => setStudentEditForm({ ...studentEditForm, notes: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-lg px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={savingStudent}
                className="rounded-lg bg-sky-600 px-4 py-2 font-bold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {savingStudent ? 'جارٍ الحفظ...' : 'حفظ التعديل'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Student Profile & History Modal */}
      {selectedStudentHistory && (
        <Modal
          isOpen={!!selectedStudentHistory}
          onClose={() => setSelectedStudentHistory(null)}
          title={`الملف المالي للطالب: ${selectedStudentHistory.student.full_name}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5 text-xs text-slate-700">
            {/* Student Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block font-medium">الهاتف</span>
                <span className="font-bold">{selectedStudentHistory.student.phone || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">هاتف الولي</span>
                <span className="font-bold">{selectedStudentHistory.student.guardian_phone || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">البريد الإلكتروني</span>
                <span className="font-bold">{selectedStudentHistory.student.email || '-'}</span>
              </div>
            </div>

            {/* Enrollments */}
            <div>
              <h4 className="font-bold text-slate-800 text-sm mb-2">الدورات والأفواج المسجل فيها</h4>
              <div className="space-y-2">
                {selectedStudentHistory.enrollments.map(enr => (
                  <div key={enr.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{enr.cohort_name} ({enr.course_name})</p>
                      <p className="text-[11px] text-slate-400">المؤطر: {enr.teacher_name}</p>
                      <p className={`mt-1 text-[11px] font-bold ${
                        enr.confirmation_status === 'pending'
                          ? 'text-amber-700'
                          : enr.confirmation_status === 'frozen'
                            ? 'text-slate-500'
                            : 'text-emerald-700'
                      }`}>
                        {enr.confirmation_status === 'pending'
                          ? 'بانتظار التأكيد — لا توجد مستحقات حتى التأكيد'
                          : enr.confirmation_status === 'frozen'
                            ? 'التسجيل مجمّد — المستحقات السابقة محفوظة'
                            : `التسجيل مؤكد${enr.billing_start_month ? ` منذ ${enr.billing_start_month}` : ''}`}
                      </p>
                    </div>
                    <div className="text-left font-mono">
                      <p className="text-xs">المطلوب: <strong>{enr.confirmation_status === 'pending' ? '—' : formatCurrency(enr.net_price)}</strong></p>
                      <p className="text-xs text-emerald-600">المدفوع: <strong>{formatCurrency(enr.paid_amount)}</strong></p>
                      <p className="text-xs text-rose-600">المتبقي: <strong>{enr.confirmation_status === 'pending' ? '—' : formatCurrency(enr.remaining_amount)}</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Receipts History */}
            <div>
              <h4 className="font-bold text-slate-800 text-sm mb-2">سجل الدفعات المستلمة</h4>
              {selectedStudentHistory.payments.length === 0 ? (
                <p className="text-slate-400 text-center py-4 bg-slate-50 rounded-xl">لا توجد دفعات مسجلة لهذا الطالب</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedStudentHistory.payments.map(p => (
                    <div key={p.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold">{p.payment_code}</span>
                        <span className="text-slate-400 block text-[11px]">{p.payment_date} • {p.method_name}</span>
                      </div>
                      <div className="font-black text-emerald-600 text-sm">
                        {formatCurrency(p.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStudentHistory(null)}
                className="px-4 py-2 bg-slate-100 font-bold rounded-xl text-slate-700 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </Modal>
      )}
      <Modal
        isOpen={isMonthlyChargeOpen}
        onClose={() => {
          if (!savingMonthlyCharge) {
            setIsMonthlyChargeOpen(false);
            setMonthlyChargeError('');
          }
        }}
        title={`إضافة مستحق شهري — ${selectedCohort?.name || ''}`}
      >
        <form onSubmit={handleBulkMonthlyCharge} className="space-y-4 text-sm text-slate-700">
          <p className="rounded-xl bg-sky-50 p-3 text-xs leading-6 text-sky-800">
            سيُضاف المبلغ لكل طالب من الطلاب المحددين ({selectedTableStudents.length} طالب)، وسيظهر ضمن المبالغ المستحقة المعتادة.
          </p>
          {monthlyChargeError && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {monthlyChargeError}
            </div>
          )}
          <label className="block text-xs font-bold text-slate-600">
            الشهر المستحق
            <input
              type="month"
              required
              value={monthlyChargeForm.month}
              onChange={event => setMonthlyChargeForm({ ...monthlyChargeForm, month: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            المبلغ لكل طالب (دج)
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={monthlyChargeForm.amount}
              onChange={event => setMonthlyChargeForm({ ...monthlyChargeForm, amount: event.target.value })}
              placeholder="مثال: 3000"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            />
          </label>
          <p className="text-xs font-bold text-slate-500">
            إجمالي الإضافة: {formatCurrency((Number(monthlyChargeForm.amount) || 0) * selectedTableStudents.length)}
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={savingMonthlyCharge}
              onClick={() => setIsMonthlyChargeOpen(false)}
              className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={savingMonthlyCharge}
              className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingMonthlyCharge ? 'جارٍ الإضافة...' : 'تأكيد إضافة المستحقات'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
