import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PayrollStandard } from './types/payroll_standard';
import { Program } from '@coral-xyz/anchor';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const IDL = require('./payroll_standard.json');


const PROGRAM_ID = new PublicKey("3CkB1YhoBxHG9uZXJ3fDkjshjb9nXdFQkLSKKNYz9vX7");
const PAYROLL_ID = "company_payroll_1"
const userA = Keypair.fromSecretKey(new Uint8Array(require("../../../deployer.json")));
const userB = Keypair.fromSecretKey(new Uint8Array(require("../../../use.json")));
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

export const getProgram = (): Program<PayrollStandard> => {
  const provider = getProvider();
  return new anchor.Program<PayrollStandard>(IDL as PayrollStandard, provider);
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