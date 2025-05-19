import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';

import { Solana } from './types/attenomics_creator_tokens';

dotenv.config();

import IDL from './attenomics_creator_tokens.json';

export const userA = Keypair.fromSecretKey(new Uint8Array(require("../../../swap.json")));
export const userB = Keypair.fromSecretKey(new Uint8Array(require("../../../chaidex.json")));

export const PROGRAM_ID = new PublicKey('BwzroF85PpoMMjmvYBgvdtXRggJUNUs6sfw6LydFjTEj');
export const GASLITE_DROP_ADDRESS = userB.publicKey  //new PublicKey(process.env.GASLITE_DROP_ADDRESS || '11111111111111111111111111111111');
export const PROTOCOL_FEE_ADDRESS = userB.publicKey //new PublicKey(process.env.PROTOCOL_FEE_ADDRESS || '11111111111111111111111111111111');
export const AI_AGENT_ADDRESS = userB.publicKey //new PublicKey(process.env.AI_AGENT_ADDRESS || '11111111111111111111111111111111');

export const getConnection = (): anchor.web3.Connection => {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  return new anchor.web3.Connection(rpcUrl, 'confirmed');
};

export const getWallet = (): anchor.Wallet => {
  return new anchor.Wallet(userA);
};

export const getProvider = (): anchor.AnchorProvider => {
  const connection = getConnection();
  const wallet = getWallet();
  return new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
};

export const getProgram = (): Program<Solana> => {
  const provider = getProvider();
  return new anchor.Program<Solana>(IDL as Solana, provider);
};

export const getEntryPointPda = async (): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddressSync([Buffer.from('entry-point')], PROGRAM_ID);
};

export const getCreatorTokenPda = async (handle: Uint8Array): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddressSync([Buffer.from('creator-token'), handle], PROGRAM_ID);
};

export const getSelfTokenVaultPda = async (tokenMint: PublicKey): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddressSync([Buffer.from('self-token-vault'), tokenMint.toBuffer()], PROGRAM_ID);
};

export const getBondingCurvePda = async (tokenMint: PublicKey): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), tokenMint.toBuffer()], PROGRAM_ID);
};

export const getSupporterContractPda = async (tokenMint: PublicKey): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddressSync([Buffer.from('supporter-contract'), tokenMint.toBuffer()], PROGRAM_ID);
};

export const getSwapRouterPda = async (): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddressSync([Buffer.from('swap-router')], PROGRAM_ID);
};

export const getAiAgentPda = async (agent: PublicKey): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddressSync([Buffer.from('ai-agent'), agent.toBuffer()], PROGRAM_ID);
};

export const getSignaturePda = async (dataHash: Uint8Array): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddressSync([Buffer.from('signature'), dataHash], PROGRAM_ID);
};

export const getAssociatedTokenAddress = async (owner: PublicKey, tokenMint: PublicKey): Promise<PublicKey> => {
  return await PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
};

export { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, SystemProgram };