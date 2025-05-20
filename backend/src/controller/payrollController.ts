import * as anchor from '@coral-xyz/anchor';
import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
// Added createTransferInstruction
import { PublicKey, Transaction } from '@solana/web3.js';
import { Request, Response } from 'express';
import { PaymentHistory } from '../models/paymentHistory';
import { getConnection, getEmployeePda, getPayrollPda, getPayrollVaultPda, getProgram, PAYROLL_ID, PROGRAM_ID, SystemProgram, TOKEN_PROGRAM_ID, userA } from '../utils/anchorClient';
import Joi from 'joi';
import { logger } from '../utils/logger';
const PAYMENT_TOKEN = new PublicKey('J1q7FEiMhzgd1T9bGtdh8ZTZa8mhsyszaW4AqQPvYxWX');
const authority = userA.publicKey;

const DECIMALS = 1_000_000_000; // Assuming 9 decimals for the token


const initializeSchema = Joi.object({
  payrollId: Joi.string().max(64).required(),
  taxRate: Joi.number().min(0).max(10000).required(), // Basis points
});

const addEmployeeSchema = Joi.object({
  payrollId: Joi.string().max(64).required(),
  employeeId: Joi.string().max(64).required(),
  salaryAmount: Joi.number().positive().required(),
  deductions: Joi.number().min(0).required(),
  paymentFrequency: Joi.string().valid('weekly', 'biweekly', 'monthly').required(),
  employeeWallet: Joi.string().required(),
});

const processPaymentSchema = Joi.object({
  payrollId: Joi.string().max(64).required(),
  employeeId: Joi.string().max(64).required(),
});

const updateEmployeeSchema = Joi.object({
  payrollId: Joi.string().max(64).required(),
  employeeId: Joi.string().max(64).required(),
  salaryAmount: Joi.number().positive().required(),
  deductions: Joi.number().min(0).required(),
  paymentFrequency: Joi.string().valid('weekly', 'biweekly', 'monthly').required(),
  isActive: Joi.boolean().required(),
});

const depositFundsSchema = Joi.object({
  payrollId: Joi.string().max(64).required(),
  amount: Joi.number().positive().required(),
});



export const initializePayroll = async (req: Request, res: Response): Promise<void> => {

  const { error } = initializeSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  }


  try {
    const { payrollId, taxRate } = req.body;
    const program = getProgram();
    const [payrollPda] = await getPayrollPda();
    const [vaultPda] = await getPayrollVaultPda(payrollPda);

    await program.methods
      .initializePayroll(payrollId, PAYMENT_TOKEN, taxRate)
      .accounts({
        payroll: payrollPda, // Matches the TypeScript types (already camelCase in IDL)
        payrollVault: vaultPda, // Changed to camelCase to match TypeScript types
        paymentToken: PAYMENT_TOKEN,
        authority: authority,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();

    logger.info(`Payroll initialized: ${payrollId} by ${req.user!.email}`);

    res.status(200).json({ message: 'Payroll initialized successfully', payroll: payrollPda.toString() });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to initialize payroll', details: err.message });
  }
};

export const addEmployee = async (req: Request, res: Response): Promise<void> => {

  const { error } = addEmployeeSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  }

  try {
    const { payrollId, employeeId, salaryAmount, deductions, paymentFrequency, employeeWallet } = req.body;
    if (!employeeId || !salaryAmount || !paymentFrequency || !employeeWallet || !deductions || !payrollId) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const program = getProgram();
    const [payrollPda] = await getPayrollPda();
    const [employeePda] = await getEmployeePda(payrollPda, employeeId);

    const salaryInLamports = Number(salaryAmount) * 1_000_000_000; // Assuming 9 decimals
    const deductionsInLamports = Number(deductions) * 1_000_000_000; // Assuming 9 decimals

    // Map the paymentFrequency string to the correct enum variant
    const normalizedFrequency = paymentFrequency.toLowerCase() as 'weekly' | 'biweekly' | 'monthly';
    if (!['weekly', 'biweekly', 'monthly'].includes(normalizedFrequency)) {
      res.status(400).json({ error: 'Invalid payment frequency. Must be "weekly", "biweekly", or "monthly".' });
      return;
    }

    // Convert the string to the correct enum variant object using the expected keys
    const frequencyEnum = normalizedFrequency === 'weekly'
      ? { weekly: {} }
      : normalizedFrequency === 'biweekly'
        ? { biWeekly: {} }
        : { monthly: {} };

    const employeeTokenWallet = await getAssociatedTokenAddress(
      PAYMENT_TOKEN,
      new PublicKey(employeeWallet),
      false,
      TOKEN_PROGRAM_ID
    );

    await program.methods
      .addEmployee(employeeId, new anchor.BN(salaryInLamports), frequencyEnum, new anchor.BN(deductionsInLamports))
      .accounts({
        payroll: payrollPda,
        employee: employeePda,
        employeeWallet: employeeTokenWallet,
        authority: authority,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any) // Keep the type assertion for now due to previous TS2353 errors
      .rpc();

    logger.info(`Employee added: ${employeeId} to payroll ${payrollId} by ${req.user!.email}`);

    res.status(200).json({ message: 'Employee added successfully', employee: employeePda.toString() });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add employee', details: err.message });
  }
};

export const processPayment = async (req: Request, res: Response): Promise<void> => {
  const { error } = processPaymentSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  }

  try {
    const { payrollId, employeeId } = req.body;
    if (!employeeId || !payrollId) {
      res.status(400).json({ error: 'Employee ID is required' });
      return;
    }

    const program = getProgram();
    const [payrollPda] = await getPayrollPda();
    const [employeePda] = await getEmployeePda(payrollPda, employeeId);
    const [vaultPda] = await getPayrollVaultPda(payrollPda);

    const employee = await program.account.employee.fetch(employeePda);
    const payroll = await program.account.payroll.fetch(payrollPda);
    const connection = getConnection();
    const vaultAccount = await getAccount(connection, vaultPda);

    // Check vault balance
    const taxAmount = (Number(employee.salaryAmount) * payroll.taxRate) / 10_000;
    const netPayment = Number(employee.salaryAmount) - taxAmount - Number(employee.deductions);
    if (Number(vaultAccount.amount) < netPayment) {
      res.status(400).json({
        error: 'Insufficient funds in payroll vault',
        required: netPayment / DECIMALS,
        available: Number(vaultAccount.amount) / DECIMALS,
      });
      return;
    }

    await program.methods
      .processPayment(employeeId)
      .accounts({
        payroll: payrollPda, // Matches the TypeScript types
        employee: employeePda, // Matches the TypeScript types
        payrollVault: vaultPda, // Changed to camelCase to match TypeScript types
        employeeWallet: employee.wallet, // Changed to camelCase to match TypeScript types
        paymentToken: payroll.paymentToken,
        authority: authority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    // Save payment history
    const paymentHistory = new PaymentHistory({
      payrollId,
      employeeId,
      amount: Number(employee.salaryAmount) / 1_000_000_000, // Assuming 9 decimals
      taxAmount: (Number(employee.salaryAmount) * payroll.taxRate) / 10_000 / DECIMALS,
      deductions: Number(employee.deductions) / DECIMALS,
      timestamp: new Date(),
    });
    await paymentHistory.save();

    logger.info(`Payment processed for employee ${employeeId} in payroll ${payrollId} by ${req.user!.email}`);

    res.status(200).json({ message: `Payment processed for employee ${employeeId}` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process payment', details: err.message });
  }
};

export const processAllPayments = async (req: Request, res: Response): Promise<void> => {
  const { payrollId } = req.body;
  if (!payrollId) {
    res.status(400).json({ error: 'Payroll ID is required' });
    return;
  }


  try {
    const program = getProgram();
    const [payrollPda] = await getPayrollPda();
    const [vaultPda] = await getPayrollVaultPda(payrollPda);

    const payroll = await program.account.payroll.fetch(payrollPda);
    const employees = await program.account.employee.all([
      { memcmp: { offset: 8, bytes: payrollPda.toBase58() } },
    ]);

    const results: { employeeId: string; status: string; error?: string }[] = [];
    for (const employee of employees) {
      const employeeId = employee.account.employeeId;
      const employeePubkey = employee.publicKey;
      const employeeWallet = employee.account.wallet;

      try {
        await program.methods
          .processPayment(employeeId)
          .accounts({
            payroll: payrollPda, // Matches the TypeScript types
            employee: employeePubkey, // Matches the TypeScript types
            payrollVault: vaultPda, // Changed to camelCase to match TypeScript types
            employeeWallet: employeeWallet, // Changed to camelCase to match TypeScript types
            paymentToken: payroll.paymentToken,
            authority: authority,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          } as any)
          .rpc();
        results.push({ employeeId, status: 'success' });

        // Save payment history
        const paymentHistory = new PaymentHistory({
          payrollId,
          employeeId,
          amount: Number(employee.account.salaryAmount) / DECIMALS,
          taxAmount: (Number(employee.account.salaryAmount) * payroll.taxRate) / 10_000 / DECIMALS,
          deductions: Number(employee.account.deductions) / DECIMALS,
          timestamp: new Date(),
        });
        await paymentHistory.save();

      } catch (err: any) {
        results.push({ employeeId, status: 'failed', error: err.message });
      }
    }

    logger.info(`Processed payments for all employees in payroll ${payrollId} by ${req.user!.email}`);
    res.status(200).json({ message: 'Processed payments for all employees', results });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process payments', details: err.message });
  }
};

export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  const { error } = updateEmployeeSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  }

  try {
    const { payrollId, employeeId, salaryAmount, deductions, paymentFrequency, isActive } = req.body;

    const program = getProgram();
    const [payrollPda] = await getPayrollPda();
    const [employeePda] = await getEmployeePda(payrollPda, employeeId);

    const salaryInLamports = Number(salaryAmount) * DECIMALS; // Assuming 6 decimals
    const deductionsInLamports = Math.round(deductions * DECIMALS);

    const normalizedFrequency = paymentFrequency.toLowerCase();
    const frequencyEnum = normalizedFrequency === 'weekly'
      ? { weekly: {} }
      : normalizedFrequency === 'biweekly'
        ? { biWeekly: {} }
        : { monthly: {} };

    await program.methods
      .updateEmployee(new anchor.BN(salaryInLamports), frequencyEnum as any, new anchor.BN(deductionsInLamports), isActive)
      .accounts({
        payroll: payrollPda, // Matches the TypeScript types
        employee: employeePda, // Matches the TypeScript types
        authority: authority, // Matches the TypeScript types
      } as any)
      .rpc();

    res.status(200).json({ message: `Employee ${employeeId} updated successfully` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update employee', details: err.message });
  }
};

export const depositFunds = async (req: Request, res: Response): Promise<void> => {
  const { error } = depositFundsSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  }

  try {
    const { payrollId, amount } = req.body;
    if (!amount) {
      res.status(400).json({ error: 'Amount is required' });
      return;
    }

    const connection = getConnection();
    const program = getProgram();
    const [payrollPda] = await getPayrollPda();
    const [vaultPda] = await getPayrollVaultPda(payrollPda);

    const payroll = await program.account.payroll.fetch(payrollPda);
    const paymentToken = payroll.paymentToken;

    const authorityTokenAccount = await getAssociatedTokenAddress(
      paymentToken,
      authority,
      true,
      TOKEN_PROGRAM_ID
    );

    // Ensure the authority has a token account
    const accountInfo = await connection.getAccountInfo(authorityTokenAccount);
    if (!accountInfo) {
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority,
          authorityTokenAccount,
          authority,
          paymentToken,
          TOKEN_PROGRAM_ID
        )
      );
      if (!program.provider.sendAndConfirm) {
        throw new Error('Provider does not support sendAndConfirm');
      }
      await program.provider.sendAndConfirm(tx);
    }

    const amountInLamports = Number(amount) * DECIMALS; // Assuming 6 decimals

    await program.methods
      .depositFunds(new anchor.BN(amountInLamports))
      .accounts({
        payroll: payrollPda,
        payrollVault: vaultPda,
        authorityTokenAccount,
        paymentToken: PAYMENT_TOKEN,
        authority: authority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();



    logger.info(`Deposited ${amount} tokens to payroll ${payrollId} by ${req.user!.email}`);
    res.status(200).json({ message: `Deposited ${amount} tokens to payroll vault` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to deposit funds', details: err.message });
  }
};

export const getPayrollData = async (req: Request, res: Response): Promise<void> => {
  const { payrollId } = req.query;
  if (!payrollId) {
    res.status(400).json({ error: 'Payroll ID is required' });
    return;
  }

  try {
    const program = getProgram();
    const connection = getConnection();
    const [payrollPda] = await getPayrollPda();
    const [vaultPda] = await getPayrollVaultPda(payrollPda);

    const payroll = await program.account.payroll.fetch(payrollPda);
    const vaultAccount = await getAccount(connection, vaultPda);
    const employees = await program.account.employee.all([
      { memcmp: { offset: 8, bytes: payrollPda.toBase58() } },
    ]);

    res.status(200).json({
      payroll: {
        payrollId: payroll.payrollId,
        employeeCount: payroll.employeeCount.toNumber(),
        vaultBalance: Number(vaultAccount.amount) / DECIMALS, // Assuming 6 decimals
        isActive: payroll.isActive,
        taxRate: payroll.taxRate / 100, // Convert basis points to percentage
      },
      employees: employees.map((emp: any) => ({
        employeeId: emp.account.employeeId,
        wallet: emp.account.wallet.toString(),
        salaryAmount: emp.account.salaryAmount.toNumber() / DECIMALS,
        paymentFrequency: Object.keys(emp.account.paymentFrequency)[0],
        lastPayment: emp.account.lastPayment.toNumber(),
        isActive: emp.account.isActive,
      })),

    });
    logger.info(`Payroll data fetched for ${payrollId} by ${req.user!.email}`);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payroll data', details: err.message });
  }
};

export const getEmployeeData = async (req: Request, res: Response): Promise<void> => {
  const { payrollId } = req.query;
  if (!payrollId) {
    res.status(400).json({ error: 'Payroll ID is required' });
    return;
  }

  try {
    const program = getProgram();
    const [payrollPda] = await getPayrollPda();
    const [employeePda] = await getEmployeePda(payrollPda, req.user!.employeeId);

    const employee = await program.account.employee.fetch(employeePda);

    res.status(200).json({
      employeeId: employee.employeeId,
      wallet: employee.wallet.toString(),
      salaryAmount: Number(employee.salaryAmount) / DECIMALS,
      deductions: Number(employee.deductions) / DECIMALS,
      paymentFrequency: Object.keys(employee.paymentFrequency)[0],
      lastPayment: employee.lastPayment.toNumber(),
      isActive: employee.isActive,
    });

    logger.info(`Employee data fetched for ${req.user!.employeeId} in payroll ${payrollId} by ${req.user!.email}`);
  } catch (err: any) {
    logger.error(`Failed to fetch employee data: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch employee data', details: err.message });
  }
};

export const getPaymentHistory = async (req: Request, res: Response): Promise<void> => {
  const { payrollId, startDate, endDate } = req.query;
  if (!payrollId) {
    res.status(400).json({ error: 'Payroll ID is required' });
    return;
  }

  try {
    const query: any = {
      payrollId: payrollId as string,
      employeeId: req.user!.employeeId!,
    };

    if (startDate) query.timestamp = { $gte: new Date(startDate as string) };
    if (endDate) query.timestamp = { ...query.timestamp, $lte: new Date(endDate as string) };

    const history = await PaymentHistory.find(query).sort({ timestamp: -1 });

    res.status(200).json(
      history.map((h) => ({
        payrollId: h.payrollId,
        employeeId: h.employeeId,
        amount: h.amount,
        taxAmount: h.taxAmount,
        deductions: h.deductions,
        timestamp: h.timestamp,
      }))
    );

    logger.info(`Payment history fetched for ${req.user!.employeeId} in payroll ${payrollId} by ${req.user!.email}`);
  } catch (err: any) {
    logger.error(`Failed to fetch payment history: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch payment history', details: err.message });
  }
};