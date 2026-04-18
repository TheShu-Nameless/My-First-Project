import { Router } from 'express';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';
import * as dashboard from '../controllers/dashboardController.js';
import * as departments from '../controllers/departmentController.js';
import * as doctors from '../controllers/doctorController.js';
import * as schedules from '../controllers/scheduleController.js';
import * as appointments from '../controllers/appointmentController.js';
import * as records from '../controllers/recordController.js';
import * as triage from '../controllers/triageController.js';
import * as tts from '../controllers/ttsController.js';
import * as admin from '../controllers/adminController.js';
import * as settings from '../controllers/settingsController.js';
import * as audit from '../controllers/auditController.js';
import publicRoutes from './public.js';
import { asyncRoute } from '../utils/asyncRoute.js';
import { forgotPasswordRateLimit, loginRateLimit, registerRateLimit } from '../middleware/security.js';

const router = Router();

router.use('/public', publicRoutes);

router.post('/auth/login', loginRateLimit, asyncRoute(auth.login));
router.post('/auth/register', registerRateLimit, asyncRoute(auth.register));
router.post('/auth/forgot-password', forgotPasswordRateLimit, asyncRoute(auth.forgotPassword));

router.use(authMiddleware);
router.get('/auth/me', asyncRoute(auth.me));

router.get('/dashboard/stats', asyncRoute(dashboard.stats));

router.get('/departments', asyncRoute(departments.listDepartments));
router.post('/departments', requireRoles('admin', 'staff'), asyncRoute(departments.createDepartment));
router.patch('/departments/:id', requireRoles('admin', 'staff'), asyncRoute(departments.updateDepartment));
router.delete('/departments/:id', requireRoles('admin'), asyncRoute(departments.deleteDepartment));

router.get('/doctors', asyncRoute(doctors.listDoctors));
router.post('/doctors', requireRoles('admin', 'staff'), asyncRoute(doctors.createDoctor));
router.patch('/doctors/:id', requireRoles('admin', 'staff'), asyncRoute(doctors.updateDoctor));

router.get('/schedules', asyncRoute(schedules.listSchedules));
router.post('/schedules', requireRoles('admin', 'staff'), asyncRoute(schedules.createSchedule));
router.patch('/schedules/:id', requireRoles('admin', 'staff'), asyncRoute(schedules.updateSchedule));
router.delete('/schedules/:id', requireRoles('admin', 'staff'), asyncRoute(schedules.deleteSchedule));

router.get('/appointments', asyncRoute(appointments.listAppointments));
router.post('/appointments', requireRoles('patient'), asyncRoute(appointments.createAppointment));
router.post('/appointments/:id/cancel', asyncRoute(appointments.cancelAppointment));
router.post('/appointments/:id/reschedule', asyncRoute(appointments.rescheduleAppointment));

router.get('/records', asyncRoute(records.listRecords));
router.post('/records', asyncRoute(records.createRecord));

router.post('/triage', asyncRoute(triage.triage));
router.get('/inquiries', asyncRoute(triage.listInquiries));
router.post('/tts/speak', asyncRoute(tts.speak));

router.get('/admin/users', requireRoles('admin'), asyncRoute(admin.listUsers));
router.post('/admin/users', requireRoles('admin'), asyncRoute(admin.createUser));
router.patch('/admin/users/:id', requireRoles('admin'), asyncRoute(admin.updateUser));
router.get('/admin/announcements', requireRoles('admin', 'staff'), asyncRoute(admin.listAnnouncements));
router.post('/admin/announcements', requireRoles('admin', 'staff'), asyncRoute(admin.createAnnouncement));
router.get('/admin/settings', requireRoles('admin'), asyncRoute(settings.getSettings));
router.patch('/admin/settings', requireRoles('admin'), asyncRoute(settings.updateSettings));
router.post('/admin/settings/ai-test', requireRoles('admin'), asyncRoute(settings.testAiConnection));
router.post('/admin/settings/tts-test', requireRoles('admin'), asyncRoute(tts.testSpeak));
router.post('/admin/settings/ai-auto-select-model', requireRoles('admin'), asyncRoute(settings.autoSelectAiModel));
router.get('/admin/settings/backups', requireRoles('admin'), asyncRoute(settings.listSettingBackups));
router.get('/admin/audit-logs', requireRoles('admin'), asyncRoute(audit.listAuditLogs));

export default router;
