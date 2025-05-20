i am sharing full code to analysis how i am doing integration of sol contracts in express bakend for payroll project u have to do sol program integration for my other project using next.js.

codes for payroll project -----------------------

sol program -->
use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};

declare_id!("4tVr3RJmMvPqfjsK7r3vCfoG2shrukhtXBfAFNZZ1dz6");

#[program]
pub mod payroll_confidential {
    use super::*;

    // Initialize payroll vault
    pub fn initialize_payroll(
        ctx: Context<InitializePayroll>,
        payroll_id: String,
        payment_token: Pubkey,
    ) -> Result<()> {
        let payroll = &mut ctx.accounts.payroll;
        payroll.authority = ctx.accounts.authority.key();
        payroll.payroll_id = payroll_id;
        payroll.payment_token = payment_token;
        payroll.employee_count = 0;
        payroll.is_active = true;
        Ok(())
    }

    // Add employee to payroll
    pub fn add_employee(
        ctx: Context<AddEmployee>,
        employee_id: String,
        salary_amount: u64,
        payment_frequency: PaymentFrequency,
    ) -> Result<()> {
        let payroll = &mut ctx.accounts.payroll;

        require!(payroll.is_active, PayrollError::PayrollInactive);
        // require!(
        //     ctx.accounts.employee_wallet.owner == ctx.accounts.employee.key(),
        //     PayrollError::InvalidWallet
        // );

        let employee = &mut ctx.accounts.employee;

        employee.payroll = payroll.key();
        employee.employee_id = employee_id;
        employee.wallet = ctx.accounts.employee_wallet.key();
        employee.salary_amount = salary_amount;
        employee.payment_frequency = payment_frequency;
        employee.last_payment = 0;
        employee.is_active = true;

        payroll.employee_count = payroll
            .employee_count
            .checked_add(1)
            .ok_or(PayrollError::ArithmeticOverflow)?;

        emit!(EmployeeAdded {
            payroll_id: payroll.payroll_id.clone(),
            employee_id: employee.employee_id.clone(),
            wallet: employee.wallet,
            salary_amount,
        });

        Ok(())
    }

    // Process payroll payment
    pub fn process_payment(ctx: Context<ProcessPayment>, employee_id: String) -> Result<()> {
        let payroll = &ctx.accounts.payroll;
        let employee = &ctx.accounts.employee;
        let clock = Clock::get()?;

        require!(payroll.is_active, PayrollError::PayrollInactive);
        require!(employee.is_active, PayrollError::EmployeeInactive);
        require!(
            employee.payroll == payroll.key(),
            PayrollError::InvalidPayroll
        );
        require!(
            employee.employee_id == employee_id,
            PayrollError::InvalidEmployeeId
        );

        // Verify payment timing
        let time_since_last_payment = clock.unix_timestamp - employee.last_payment;
        let required_interval = match employee.payment_frequency {
            PaymentFrequency::Weekly => 7 * 24 * 60 * 60,
            PaymentFrequency::BiWeekly => 14 * 24 * 60 * 60,
            PaymentFrequency::Monthly => 30 * 24 * 60 * 60,
        };

        require!(
            employee.last_payment == 0 || time_since_last_payment >= required_interval,
            PayrollError::PaymentTooSoon
        );

        let payroll_bump = ctx.bumps.payroll;
        let id_bytes = payroll.payroll_id.as_bytes();
        let seeds = &[b"payroll", id_bytes, &[payroll_bump]];
        let signer_seeds = &[&seeds[..]];

        // Use token transfer instead of system transfer for SPL tokens
        let transfer_instruction = Transfer {
            from: ctx.accounts.payroll_vault.to_account_info(),
            to: ctx.accounts.employee_wallet.to_account_info(),
            authority: ctx.accounts.payroll.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, transfer_instruction).with_signer(signer_seeds);

        anchor_spl::token::transfer(cpi_ctx, employee.salary_amount)?;

        // Update employee record
        let employee = &mut ctx.accounts.employee;
        employee.last_payment = clock.unix_timestamp;

        emit!(PaymentProcessed {
            payroll_id: payroll.payroll_id.clone(),
            employee_id,
            amount: employee.salary_amount,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    // Update employee details
    pub fn update_employee(
        ctx: Context<UpdateEmployee>,
        salary_amount: u64,
        payment_frequency: PaymentFrequency,
        is_active: bool,
    ) -> Result<()> {
        let employee = &mut ctx.accounts.employee;
        require!(
            ctx.accounts.payroll.is_active,
            PayrollError::PayrollInactive
        );

        employee.salary_amount = salary_amount;
        employee.payment_frequency = payment_frequency;
        employee.is_active = is_active;

        emit!(EmployeeUpdated {
            payroll_id: ctx.accounts.payroll.payroll_id.clone(),
            employee_id: employee.employee_id.clone(),
            salary_amount,
            is_active,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(payroll_id: String)]
pub struct InitializePayroll<'info> {
    #[account(
        init,
        payer = authority,
        space = Payroll::LEN,
        seeds = [b"payroll", payroll_id.as_bytes()],
        bump
    )]
    pub payroll: Account<'info, Payroll>,
    #[account(
        init,
        payer = authority,
        token::mint = payment_token,
        token::authority = payroll,
        seeds = [b"vault", payroll.key().as_ref()],
        bump
    )]
    pub payroll_vault: Account<'info, TokenAccount>,
    pub payment_token: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(employee_id: String)]
pub struct AddEmployee<'info> {
    #[account(mut, has_one = authority)]
    pub payroll: Account<'info, Payroll>,
    #[account(
        init,
        payer = authority,
        space = Employee::LEN,
        seeds = [b"employee", payroll.key().as_ref(), employee_id.as_bytes()],
        bump
    )]
    pub employee: Account<'info, Employee>,
    pub employee_wallet: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ProcessPayment<'info> {
    #[account(
        has_one = authority,
        has_one = payment_token,
        seeds = [b"payroll", payroll.payroll_id.as_bytes()],
        bump
    )]
    pub payroll: Account<'info, Payroll>,
    #[account(
        mut,
        constraint = employee.wallet == employee_wallet.key()
    )]
    pub employee: Account<'info, Employee>,
    #[account(mut)]
    pub payroll_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub employee_wallet: Account<'info, TokenAccount>,
    pub payment_token: Account<'info, Mint>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateEmployee<'info> {
    #[account(has_one = authority)]
    pub payroll: Account<'info, Payroll>,
    #[account(mut)]
    pub employee: Account<'info, Employee>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Payroll {
    pub authority: Pubkey,
    pub payroll_id: String,
    pub payment_token: Pubkey,
    pub employee_count: u64,
    pub is_active: bool,
}

#[account]
pub struct Employee {
    pub payroll: Pubkey,
    pub employee_id: String,
    pub wallet: Pubkey,
    pub salary_amount: u64,
    pub payment_frequency: PaymentFrequency,
    pub last_payment: i64,
    pub is_active: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PaymentFrequency {
    Weekly,
    BiWeekly,
    Monthly,
}

#[error_code]
pub enum PayrollError {
    #[msg("Payroll is not active")]
    PayrollInactive,
    #[msg("Employee is not active")]
    EmployeeInactive,
    #[msg("Invalid payroll account")]
    InvalidPayroll,
    #[msg("Invalid employee ID")]
    InvalidEmployeeId,
    #[msg("Payment attempted too soon")]
    PaymentTooSoon,
    #[msg("Invalid wallet account")]
    InvalidWallet,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    #[msg("Active employees exist")]
    ActiveEmployeesExist,
}

#[event]
pub struct EmployeeAdded {
    pub payroll_id: String,
    pub employee_id: String,
    pub wallet: Pubkey,
    pub salary_amount: u64,
}

#[event]
pub struct PaymentProcessed {
    pub payroll_id: String,
    pub employee_id: String,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct EmployeeUpdated {
    pub payroll_id: String,
    pub employee_id: String,
    pub salary_amount: u64,
    pub is_active: bool,
}

#[event]
pub struct PayrollClosed {
    pub payroll_id: String,
}

// Constants for account sizes
impl Payroll {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        4 + 64 + // payroll_id (String with max 64 chars)
        32 + // payment_token
        8 + // employee_count
        1; // is_active
}

impl Employee {
    pub const LEN: usize = 8 + // discriminator
        32 + // payroll
        4 + 64 + // employee_id (String with max 64 chars)
        32 + // wallet
        8 + // salary_amount
        1 + // payment_frequency
        8 + // last_payment
        1; // is_active
}

express project -----------
package.json :
{
  "name": "solana-test",
  "version": "1.0.0",
  "description": "",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "nodemon src/index.ts",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@coral-xyz/anchor": "^0.31.1",
    "@solana/spl-token": "^0.4.8",
    "@solana/wallet-adapter-base": "^0.9.25",
    "@solana/wallet-adapter-react": "^0.15.35",
    "@solana/wallet-adapter-react-ui": "^0.9.35",
    "@solana/wallet-adapter-wallets": "^0.19.32",
    "@solana/web3.js": "^1.98.0",
    "bs58": "^5.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "nodemon": "^3.0.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}

index.js -->
import express, { Express } from 'express';
import cors from 'cors';
import payrollRoutes from './payrollRoutes';

const app: Express = express();

app.use(cors());
app.use(express.json());

app.use('/api/payroll', payrollRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


src/payrollRoutes.ts :
import { Router } from 'express';
import {
    initializePayroll,
    addEmployee,
    processPayment,
    processAllPayments,
    updateEmployee,
    depositFunds,
    getPayrollData,
} from './payrollController';

const router = Router();

router.post('/initialize', initializePayroll);
router.post('/add-employee', addEmployee);
router.post('/process-payment', processPayment);
router.post('/process-all-payments', processAllPayments);
router.post('/update-employee', updateEmployee);
router.post('/deposit-funds', depositFunds);
router.get('/data', getPayrollData);

export default router;

src/payrollController.ts :
import * as anchor from '@coral-xyz/anchor';
import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
// Added createTransferInstruction
import { PublicKey, Transaction } from '@solana/web3.js';
import { Request, Response } from 'express';

import { getConnection, getEmployeePda, getPayrollPda, getPayrollVaultPda, getProgram, PAYROLL_ID, PROGRAM_ID, SystemProgram, TOKEN_PROGRAM_ID, userA } from './anchorClient';

const PAYMENT_TOKEN = new PublicKey('J1q7FEiMhzgd1T9bGtdh8ZTZa8mhsyszaW4AqQPvYxWX');
const authority = userA.publicKey;

export const initializePayroll = async (req: Request, res: Response): Promise<void> => {
  try {
    const program = getProgram();
    const [payrollPda] = await getPayrollPda();
    const [vaultPda] = await getPayrollVaultPda(payrollPda);

    await program.methods
      .initializePayroll(PAYROLL_ID, PAYMENT_TOKEN)
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

    res.status(200).json({ message: 'Payroll initialized successfully', payroll: payrollPda.toString() });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to initialize payroll', details: err.message });
  }
};

export const addEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, salaryAmount, paymentFrequency, employeeWallet } = req.body;
    if (!employeeId || !salaryAmount || !paymentFrequency || !employeeWallet) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const program = getProgram();
    const [payrollPda] = await getPayrollPda();
    const [employeePda] = await getEmployeePda(payrollPda, employeeId);

    const salaryInLamports = Number(salaryAmount) * 1_000_000_000; // Assuming 9 decimals

    // Map the paymentFrequency string to the correct enum variant
    const normalizedFrequency = paymentFrequency.toLowerCase() as 'weekly' | 'biweekly' | 'monthly';
    if (!['weekly', 'biweekly', 'monthly'].includes(normalizedFrequency)) {
      res.status(400).json({ error: 'Invalid payment frequency. Must be "weekly", "biweekly", or "monthly".' });
      return;
    }

    // Convert the string to the correct enum variant object
    const frequency = {
      weekly: { Weekly: {} },
      biweekly: { BiWeekly: {} },
      monthly: { Monthly: {} },
    }[normalizedFrequency];

    const employeeTokenWallet = await getAssociatedTokenAddress(
      PAYMENT_TOKEN,
      new PublicKey(employeeWallet),
      false,
      TOKEN_PROGRAM_ID
    );

    await program.methods
      .addEmployee(employeeId, new anchor.BN(salaryInLamports), { weekly: {} })
      .accounts({
        payroll: payrollPda,
        employee: employeePda,
        employeeWallet: employeeTokenWallet,
        authority: authority,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any) // Keep the type assertion for now due to previous TS2353 errors
      .rpc();

    res.status(200).json({ message: 'Employee added successfully', employee: employeePda.toString() });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add employee', details: err.message });
  }
};

export const processPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      res.status(400).json({ error: 'Employee ID is required' });
      return;
    }

    const program = getProgram();
    const [payrollPda] = await getPayrollPda();
    const [employeePda] = await getEmployeePda(payrollPda, employeeId);
    const [vaultPda] = await getPayrollVaultPda(payrollPda);

    const employee = await program.account.employee.fetch(employeePda);
    const payroll = await program.account.payroll.fetch(payrollPda);

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

    res.status(200).json({ message: `Payment processed for employee ${employeeId}` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process payment', details: err.message });
  }
};

export const processAllPayments = async (req: Request, res: Response): Promise<void> => {
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
      } catch (err: any) {
        results.push({ employeeId, status: 'failed', error: err.message });
      }
    }

    res.status(200).json({ message: 'Processed payments for all employees', results });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process payments', details: err.message });
  }
};

export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, salaryAmount, paymentFrequency, isActive } = req.body;
    if (!employeeId || !salaryAmount || !paymentFrequency || isActive === undefined) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const program = getProgram();
    const [payrollPda] = await getPayrollPda();
    const [employeePda] = await getEmployeePda(payrollPda, employeeId);

    const salaryInLamports = Number(salaryAmount) * 1_000_000_000; // Assuming 6 decimals
    const frequency = paymentFrequency.charAt(0).toUpperCase() + paymentFrequency.slice(1).toLowerCase();
    if (!['Weekly', 'BiWeekly', 'Monthly'].includes(frequency)) {
      res.status(400).json({ error: 'Invalid payment frequency. Must be "weekly", "biweekly", or "monthly".' });
      return;
    }

    await program.methods
      .updateEmployee(new anchor.BN(salaryInLamports), frequency as any, isActive)
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
  try {
    const { amount } = req.body;
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

    const amountInLamports = Number(amount) * 1_000_000; // Assuming 6 decimals

    // Removed redundant createAssociatedTokenAccountInstruction call
    const transferTx = new Transaction().add(
      createTransferInstruction(
        authorityTokenAccount,
        vaultPda,
        authority,
        amountInLamports,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    if (!program.provider.sendAndConfirm) {
      throw new Error('Provider does not support sendAndConfirm');
    }
    await program.provider.sendAndConfirm(transferTx);

    res.status(200).json({ message: `Deposited ${amount} tokens to payroll vault` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to deposit funds', details: err.message });
  }
};

export const getPayrollData = async (req: Request, res: Response): Promise<void> => {
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
        vaultBalance: Number(vaultAccount.amount) / 1_000_000, // Assuming 6 decimals
        isActive: payroll.isActive,
      },
      employees: employees.map((emp: any) => ({
        employeeId: emp.account.employeeId,
        wallet: emp.account.wallet.toString(),
        salaryAmount: emp.account.salaryAmount.toNumber() / 1_000_000,
        paymentFrequency: Object.keys(emp.account.paymentFrequency)[0],
        lastPayment: emp.account.lastPayment.toNumber(),
        isActive: emp.account.isActive,
      })),
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payroll data', details: err.message });
  }
};


a helper : src/anchorClient :
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PayrollConfidential } from './types/payroll_confidential';
import { Program } from '@coral-xyz/anchor';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const IDL = require('./payroll_standard.json');


const PROGRAM_ID = new PublicKey("4tVr3RJmMvPqfjsK7r3vCfoG2shrukhtXBfAFNZZ1dz6");
const PAYROLL_ID = "company_payroll_1"
const userA = Keypair.fromSecretKey(new Uint8Array(require("../swap.json")));
const userB = Keypair.fromSecretKey(new Uint8Array(require("../chaidex.json")));
export const getConnection = (): anchor.web3.Connection => {
  return new anchor.web3.Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
};

export const getWallet = (): anchor.Wallet => {
  return new anchor.Wallet(userA);
};

export const getProvider = (): anchor.AnchorProvider => {
  const connection = getConnection();
  const wallet = getWallet();
  return new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
};

export const getProgram = (): Program<PayrollConfidential> => {
  const provider = getProvider();
  return new anchor.Program<PayrollConfidential>(IDL as PayrollConfidential, provider);
};

// Utility functions to derive PDAs
export const getPayrollPda = async (): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddressSync(
    [Buffer.from('payroll'), Buffer.from(PAYROLL_ID)],
    PROGRAM_ID
  );
};

export const getPayrollVaultPda = async (payrollPda: PublicKey): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), payrollPda.toBuffer()],
    PROGRAM_ID
  );
};

export const getEmployeePda = async (payrollPda: PublicKey, employeeId: string): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddressSync(
    [Buffer.from('employee'), payrollPda.toBuffer(), Buffer.from(employeeId)],
    PROGRAM_ID
  );
};

export { PROGRAM_ID, TOKEN_PROGRAM_ID, SystemProgram, PAYROLL_ID, userA, userB };

and we have two files : type and idl file for program ...