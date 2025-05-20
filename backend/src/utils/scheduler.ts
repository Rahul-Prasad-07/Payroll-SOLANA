// import cron from 'node-cron';
// import { getProgram, getConnection, getPayrollPda, getPayrollVaultPda, SystemProgram, TOKEN_PROGRAM_ID } from './anchorClient';
// import { logger } from './logger';
// import { PaymentHistory } from '../models/paymentHistory';

// export const schedulePayments = (): void => {
//   // Run every day at midnight
//   cron.schedule('0 0 * * *', async () => {
//     try {
//       const program = getProgram();
//       const payrollIds = process.env.PAYROLL_IDS?.split(',') || [];

//       for (const payrollId of payrollIds) {
//         const [payrollPda] = await getPayrollPda(payrollId);
//         const [vaultPda] = await getPayrollVaultPda(payrollPda);

//         const payroll = await program.account.payroll.fetch(payrollPda);
//         const employees = await program.account.employee.all([
//           { memcmp: { offset: 8, bytes: payrollPda.toBase58() } },
//         ]);

//         const transaction = new Transaction();
//         const results: { employeeId: string; status: string; error?: string }[] = [];

//         for (const employee of employees) {
//           const employeeId = employee.account.employeeId;
//           const employeePubkey = employee.publicKey;
//           const employeeWallet = employee.account.wallet;

//           try {
//             const instruction = await program.methods
//               .processPayment(employeeId)
//               .accounts({
//                 payroll: payrollPda,
//                 employee: employeePubkey,
//                 payrollVault: vaultPda,
//                 employeeWallet: employeeWallet,
//                 paymentToken: payroll.paymentToken,
//                 authority: process.env.ADMIN_PUBLIC_KEY!,
//                 tokenProgram: TOKEN_PROGRAM_ID,
//                 systemProgram: SystemProgram.programId,
//               })
//               .instruction();

//             transaction.add(instruction);
//             results.push({ employeeId, status: 'queued' });

//             // Save payment history
//             const paymentHistory = new PaymentHistory({
//               payrollId,
//               employeeId,
//               amount: Number(employee.account.salary_amount) / 1_000_000,
//               taxAmount: (Number(employee.account.salary_amount) * payroll.tax_rate) / 10_000 / 1_000_000,
//               deductions: Number(employee.account.deductions) / 1_000_000,
//               timestamp: new Date(),
//             });
//             await paymentHistory.save();
//           } catch (err: any) {
//             results.push({ employeeId, status: 'failed', error: err.message });
//           }
//         }

//         if (transaction.instructions.length > 0) {
//           await program.provider.sendAndConfirm!(transaction);
//           results.forEach((result) => {
//             if (result.status === 'queued') result.status = 'success';
//           });
//         }

//         logger.info(`Scheduled payments processed for payroll ${payrollId}`, { results });
//       }
//     } catch (err: any) {
//       logger.error(`Failed to process scheduled payments: ${err.message}`);
//     }
//   });
// };