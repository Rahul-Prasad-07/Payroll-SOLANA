import { Router } from 'express';
import {
    initializePayroll,
    addEmployee,
    processPayment,
    processAllPayments,
    updateEmployee,
    depositFunds,
    getPayrollData,
    getPaymentHistory,
    getEmployeeData,
} from '../controller/payrollController';
import { authenticate, restrictTo } from '../utils/auth';

const router = Router();

// Admin-only routes
router.post(
    '/initialize',
    authenticate,
    restrictTo('admin'),
    initializePayroll
);
router.post('/add-employee', authenticate, restrictTo('admin'), addEmployee);
router.post(
    '/process-payment',
    authenticate,
    restrictTo('admin'),
    processPayment
);
router.post(
    '/process-all-payments',
    authenticate,
    restrictTo('admin'),
    processAllPayments
);
router.post(
    '/update-employee',
    authenticate,
    restrictTo('admin'),
    updateEmployee
);
router.post('/deposit-funds', authenticate, restrictTo('admin'), depositFunds);
router.get('/data', authenticate, restrictTo('admin'), getPayrollData);

// Employee-accessible routes
router.get(
    '/employee-data',
    authenticate,
    restrictTo('employee'),
    getEmployeeData
);
router.get(
    '/payment-history',
    authenticate,
    restrictTo('employee'),
    getPaymentHistory
);

export default router;