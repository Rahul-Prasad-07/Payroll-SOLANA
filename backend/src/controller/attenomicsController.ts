import * as anchor from '@coral-xyz/anchor';
import * as borsh from '@coral-xyz/borsh';
import { irysStorage, keypairIdentity, Metaplex } from '@metaplex-foundation/js';
import { createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { createHash } from 'crypto';
import { Request, Response } from 'express';

import { AI_AGENT_ADDRESS, ASSOCIATED_TOKEN_PROGRAM_ID, GASLITE_DROP_ADDRESS, getAiAgentPda, getAssociatedTokenAddress, getBondingCurvePda, getConnection, getCreatorTokenPda, getEntryPointPda, getProgram, getSelfTokenVaultPda, getSignaturePda, getSupporterContractPda, getSwapRouterPda, PROGRAM_ID, PROTOCOL_FEE_ADDRESS, SystemProgram, TOKEN_PROGRAM_ID, userA, userB } from '../utils/anchorClient';

const connection = getConnection();

const metaplex = Metaplex.make(connection)
  .use(keypairIdentity(userA))
  .use(
    irysStorage({
      address: 'https://devnet.irys.xyz',
      providerUrl: 'https://api.devnet.solana.com',
      timeout: 60000,
    })
  );

// Define Borsh schema for VaultConfig
const vaultConfigSchema = borsh.struct([
  borsh.u8('drip_percentage'),
  borsh.i64('drip_interval'),
  borsh.i64('lock_time'),
  borsh.u8('locked_percentage'),
]);

// Define Borsh schema for DistributorConfig
const distributorConfigSchema = borsh.struct([
  borsh.u64('daily_drip_amount'),
  borsh.i64('drip_interval'),
  borsh.u16('total_days'),
]);
// Buffer sizes for structs (calculated manually)
const VAULT_CONFIG_SIZE = 18; // 1 (u8) + 8 (i64) + 8 (i64) + 1 (u8)
const DISTRIBUTOR_CONFIG_SIZE = 18; // 8 (u64) + 8 (i64) + 2 (u16)
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');


export const initialize = async (req: Request, res: Response): Promise<void> => {
  try {
    const program = getProgram();
    const [entryPointPda] = await getEntryPointPda();

    await program.methods
      .initialize(PROTOCOL_FEE_ADDRESS)
      .accounts({
        entryPoint: entryPointPda,
        gasliteDrop: GASLITE_DROP_ADDRESS,
        authority: userA.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    res.status(200).json({ message: 'Protocol initialized successfully', entryPoint: entryPointPda.toString() });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to initialize protocol', details: err.message });
  }
};

// export const initializeSwapRouter = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const program = getProgram();
//     const [swapRouterPda] = await getSwapRouterPda();

//     const tx = await program.methods
//       .initializeSwapRouter()
//       .accounts({
//         swapRouter: swapRouterPda,
//         authority: program.provider.wallet!.publicKey,
//         systemProgram: SystemProgram.programId,
//       } as any)
//       .rpc();

//     console.log('Transaction signature:', tx);

//     res.status(200).json({ message: 'Swap router initialized successfully', swapRouter: swapRouterPda.toString() });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to initialize swap router', details: err.message });
//   }
// };



export const deployCreatorToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      handle,
      name,
      symbol,
      totalSupply,
      selfPercent,
      marketPercent,
      supporterPercent,
      nftMetadataUri,
      aiAgent,
    } = req.body;
    if (
      !handle ||
      !name ||
      !symbol ||
      !totalSupply ||
      !selfPercent ||
      !marketPercent ||
      !supporterPercent ||
      !nftMetadataUri ||
      !aiAgent
    ) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    // Validate percentages
    if (selfPercent + marketPercent + supporterPercent !== 100) {
      res.status(400).json({ error: 'Percentages must sum to 100' });
      return;
    }

    const program = getProgram();
    const provider = program.provider;
    const connection = provider.connection;
    const wallet = provider.wallet;
    const handleHash = createHash('sha256').update(handle).digest();
    const tokenMint = Keypair.generate();
    const [creatorTokenPda] = await getCreatorTokenPda(handleHash);
    const [selfTokenVaultPda] = await getSelfTokenVaultPda(tokenMint.publicKey);
    const [bondingCurvePda] = await getBondingCurvePda(tokenMint.publicKey);
    const [supporterContractPda] = await getSupporterContractPda(tokenMint.publicKey);
    const [entryPointPda] = await getEntryPointPda();
    const [nftPda] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from('nft'),
        new anchor.BN((await program.account.attenomicsEntryPoint.fetch(entryPointPda)).nextTokenId).toArrayLike(
          Buffer,
          'le',
          8
        ),
      ],
      PROGRAM_ID
    );
    const [aiAgentPda] = await getAiAgentPda(new PublicKey(aiAgent));

    console.log("EntryPointPda -->", entryPointPda.toString());
    console.log("CreatorTokenPda -->", creatorTokenPda.toString());
    console.log("SelfTokenVaultPda -->", selfTokenVaultPda.toString());
    console.log("BondingCurvePda -->", bondingCurvePda.toString());
    console.log("SupporterContractPda -->", supporterContractPda.toString());
    console.log("NFTPda -->", nftPda.toString());
    console.log("AiAgentPda -->", aiAgentPda.toString());
    console.log("TokenMint -->", tokenMint.publicKey.toString());
    console.log("Wallet -->", wallet!.publicKey.toString());

    const config = {
      totalSupply: new anchor.BN(totalSupply * 1_000_000_000),
      selfPercent: Number(selfPercent),
      marketPercent: Number(marketPercent),
      supporterPercent: Number(supporterPercent), // Fix: Use supporterPercent
      handle: Array.from(handleHash),
      aiAgent: new PublicKey(aiAgent),
    };

    // Define vaultConfig with program-compatible field names and BN for i64
    const vaultConfig = {
      drip_percentage: 10,
      drip_interval: new anchor.BN(86400), // 1 day
      lock_time: new anchor.BN(31536000), // 1 year
      locked_percentage: 80,
    };

    // Validate vaultConfig
    if (vaultConfig.drip_percentage > 100 || vaultConfig.locked_percentage > 100) {
      res.status(400).json({ error: 'Drip percentage and locked percentage must be between 0 and 100' });
      return;
    }

    // Serialize vaultConfig using Borsh
    const vaultConfigBuffer = Buffer.alloc(VAULT_CONFIG_SIZE);
    vaultConfigSchema.encode(vaultConfig, vaultConfigBuffer);

    // Define distributorConfig with program-compatible field names and BN for i64/u64
    const distributorConfig = {
      daily_drip_amount: new anchor.BN(500 * 1_000_000_000), // 500 tokens
      drip_interval: new anchor.BN(86400), // 1 day
      total_days: 365,
    };

    // Validate distributorConfig
    if (
      distributorConfig.daily_drip_amount.lte(new anchor.BN(0)) ||
      distributorConfig.drip_interval.lte(new anchor.BN(0)) ||
      distributorConfig.total_days <= 0
    ) {
      res.status(400).json({ error: 'Invalid distributor config: fields must be positive' });
      return;
    }

    // Validate total distribution
    const totalDistribution = distributorConfig.daily_drip_amount.mul(new anchor.BN(distributorConfig.total_days));
    const supporterTokens = config.totalSupply.mul(new anchor.BN(config.supporterPercent)).div(new anchor.BN(100));
    if (totalDistribution.gt(supporterTokens)) {
      res.status(400).json({ error: 'Total distribution exceeds supporter allocation' });
      return;
    }

    // Serialize distributorConfig using Borsh
    const distributorConfigBuffer = Buffer.alloc(DISTRIBUTOR_CONFIG_SIZE);
    distributorConfigSchema.encode(distributorConfig, distributorConfigBuffer);

    const tx = await program.methods
      .deployCreatorToken(
        config,
        distributorConfigBuffer,
        vaultConfigBuffer,
        name,
        symbol,
        nftMetadataUri
      )
      .accounts({
        entryPoint: entryPointPda,
        creatorTokenAccount: creatorTokenPda,
        nftAccount: nftPda,
        aiAgentAccount: aiAgentPda,
        selfTokenVault: selfTokenVaultPda,
        bondingCurve: bondingCurvePda,
        supporterContract: supporterContractPda,
        tokenMint: tokenMint.publicKey,
        creator: userA.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([tokenMint])
      .rpc();

    console.log('deployCreatorToken Transaction signature:', tx);


    // Create bonding curve's WSOL account
    const bondingCurveWsolAccount = await getAssociatedTokenAddress(bondingCurvePda, WSOL_MINT);
    const wsolAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet!.publicKey,
        bondingCurveWsolAccount,
        bondingCurvePda,
        WSOL_MINT
      )
    );
    const wsolAtaTxSig = await provider.sendAndConfirm!(wsolAtaTx);
    console.log('Created bonding curve WSOL ATA, transaction signature:', wsolAtaTxSig);


    // Step 2: Create associated token accounts
    const vaultTokenAccount = await getAssociatedTokenAddress(selfTokenVaultPda, tokenMint.publicKey);
    const supporterTokenAccount = await getAssociatedTokenAddress(supporterContractPda, tokenMint.publicKey);

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet!.publicKey, // payer
        vaultTokenAccount, // associated token account
        selfTokenVaultPda, // owner
        tokenMint.publicKey // mint
      ),
      createAssociatedTokenAccountInstruction(
        wallet!.publicKey, // payer
        supporterTokenAccount, // associated token account
        supporterContractPda, // owner
        tokenMint.publicKey // mint
      )
    );

    const createAtaTxSig = await provider.sendAndConfirm!(transaction);
    console.log('Create ATA Transaction signature:', createAtaTxSig);



    // Step 2: Mint initial tokens
    const minitInitialTokensTxSig = await program.methods
      .mintInitialTokens()
      .accounts({
        creatorTokenAccount: creatorTokenPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        vaultTokenAccount,
        supporterTokenAccount,
        selfTokenVault: selfTokenVaultPda,
        supporterContract: supporterContractPda,
        creator: program.provider.wallet!.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    console.log("mintInitialTokens tx sig", minitInitialTokensTxSig)




    res.status(200).json({
      message: 'Creator token deployed successfully',
      tokenMint: tokenMint.publicKey.toString(),
      creatorTokenAccount: creatorTokenPda.toString(),
      nftAccount: nftPda.toString(),
      transactionSignature: tx,
      minitInitialTokensTxSig: minitInitialTokensTxSig,
      metadata: {
        name,
        symbol,
        uri: nftMetadataUri,
      },
    });

  } catch (err: any) {
    console.error(err);
    if (err.message.includes('AIAgentNotAllowed')) {
      res.status(400).json({ error: 'AI agent not allowed. Register the agent using set-ai-agent.' });
    } else if (err.message.includes('HandleAlreadyUsed')) {
      res.status(400).json({ error: 'Handle already used. Choose a different handle.' });
    } else if (err.message.includes('InsufficientFunds')) {
      res.status(400).json({ error: 'Insufficient SOL in wallet. Fund the wallet and try again.' });
    } else {
      res.status(500).json({ error: 'Failed to deploy token', details: err.message });
    }
  }
};


export const getTokenPrice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tokenMint } = req.query; // Use query parameter for GET request
    if (!tokenMint || typeof tokenMint !== 'string') {
      res.status(400).json({ error: 'tokenMint is required as a query parameter' });
      return;
    }

    const program = getProgram();
    const connection = getConnection();
    const tokenMintPubkey = new PublicKey(tokenMint);
    const [bondingCurvePda] = await getBondingCurvePda(tokenMintPubkey);

    // Fetch bonding curve account
    let bondingCurveAccount;
    try {
      bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurvePda);
    } catch (error) {
      res.status(400).json({ error: 'Bonding curve account not found or invalid' });
      return;
    }

    // Bonding curve parameters
    const currentSupply = bondingCurveAccount.purchaseMarketSupply.toNumber();
    const feePercent = bondingCurveAccount.buyFeePercent; // 50 basis points = 0.5%
    const initialPrice = bondingCurveAccount.initialPrice.toNumber();
    const VIRTUAL_RESERVE_SOL = 500_000_000; // 0.5 SOL in lamports
    const VIRTUAL_TOKEN_SUPPLY = 10_000_000_000_000_000; // 10M tokens * 10^9

    // Validate supply
    const amount = 1_000_000_000; // 1 token in base units (9 decimals)
    if (currentSupply + amount > VIRTUAL_TOKEN_SUPPLY) {
      res.status(400).json({
        error: `Bonding curve supply exhausted. Cannot calculate price.`,
        remainingSupply: (VIRTUAL_TOKEN_SUPPLY - currentSupply) / 1_000_000_000,
      });
      return;
    }

    // Calculate price for 1 token
    const price = calculateBuyPrice(currentSupply, amount, feePercent, initialPrice);
    const priceInSol = price / 1_000_000_000; // Convert lamports to SOL

    res.status(200).json({
      tokenMint,
      price: priceInSol,
      unit: 'SOL',
      supply: currentSupply / 1_000_000_000,
      remainingSupply: (VIRTUAL_TOKEN_SUPPLY - currentSupply) / 1_000_000_000,
    });
  } catch (err: any) {
    console.error('Error in getTokenPrice:', err);
    res.status(500).json({
      error: 'Failed to fetch token price',
      details: err.message,
      logs: err.logs || [],
    });
  }
};

// Helper function to calculate buy price (mirrors program's calculate_buy_price)
function calculateBuyPrice(supply: number, amount: number, feePercent: number, initialPrice: number): number {
  const VIRTUAL_RESERVE_SOL = 500_000_000; // 0.5 SOL in lamports
  const VIRTUAL_TOKEN_SUPPLY = 10_000_000_000_000_000; // 10M tokens * 10^9

  const currentSol = VIRTUAL_RESERVE_SOL + (supply * initialPrice) / 1_000_000_000;
  const newSol = (currentSol * VIRTUAL_TOKEN_SUPPLY) / (VIRTUAL_TOKEN_SUPPLY - supply - amount);
  const solNeeded = newSol - currentSol;
  const totalWithFee = (solNeeded * (10000 + feePercent)) / 10000; // Apply fee (e.g., 0.5%)
  return totalWithFee;
}

export const buyTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tokenMint, amount, useNativeSol } = req.body;
    if (!tokenMint || !amount) {
      res.status(400).json({ error: 'Token mint and amount are required' });
      return;
    }

    const program = getProgram();
    const buyer = program.provider.wallet!.publicKey
    const [bondingCurvePda] = await getBondingCurvePda(new PublicKey(tokenMint));
    const buyerTokenAccount = await getAssociatedTokenAddress(buyer, new PublicKey(tokenMint));
    const buyerWsolAccount = await getAssociatedTokenAddress(buyer, WSOL_MINT);
    const bondingCurveWsolAccount = await getAssociatedTokenAddress(bondingCurvePda, WSOL_MINT);


    console.log('buyerTokenAccount', buyerTokenAccount.toString());
    console.log('bondingCurvePda', bondingCurvePda.toString());

    //const bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurvePda);
    //const currentSupply = bondingCurveAccount.purchaseMarketSupply.toNumber();
    const VIRTUAL_TOKEN_SUPPLY = 10_000_000; // Match program's constant

    // Fetch bonding curve account to check current supply
    let bondingCurveAccount;
    try {
      bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurvePda);
    } catch (error) {
      res.status(400).json({ error: 'Bonding curve account not found or invalid' });
      return;
    }

    const currentSupply = bondingCurveAccount.purchaseMarketSupply.toNumber();

    // Validate amount against virtual supply
    const requestedAmount = amount * 1_000_000_000; // Convert to base units (9 decimals)
    if (currentSupply + requestedAmount > VIRTUAL_TOKEN_SUPPLY) {
      const maxTokens = (VIRTUAL_TOKEN_SUPPLY - currentSupply) / 1_000_000_000;
      res.status(400).json({
        error: `Requested amount exceeds available virtual supply. Max: ${maxTokens.toFixed(2)} tokens`,
      });
      return;
    }

    // Create buyer's WSOL account if it doesn't exist
    try {
      await getAccount(connection, buyerWsolAccount);
    } catch (error) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          buyer,
          buyerWsolAccount,
          buyer,
          WSOL_MINT
        )
      );
      const signature = await program.provider.sendAndConfirm!(transaction);
      console.log('Created buyer WSOL ATA, transaction signature:', signature);
    }

    // Create buyer's token account if it doesn't exist
    try {
      await getAccount(connection, buyerTokenAccount);
    } catch (error) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          buyer,
          buyerTokenAccount,
          buyer,
          new PublicKey(tokenMint)
        )
      );
      const signature = await program.provider.sendAndConfirm!(transaction);
      console.log('Created buyer token ATA, transaction signature:', signature);
    }

    // Check buyer's SOL balance if using native SOL
    if (useNativeSol) {
      const balance = await connection.getBalance(buyer);
      const minBalance = requestedAmount / 10; // Rough estimate: price is ~amount/10 SOL
      if (balance < minBalance) {
        res.status(400).json({
          error: `Insufficient SOL balance. Required: ~${minBalance / 1_000_000_000} SOL, Available: ${balance / 1_000_000_000} SOL`,
        });
        return;
      }
    } else {
      // Check buyer's WSOL balance
      const wsolAccount = await getAccount(connection, buyerWsolAccount);
      const minBalance = requestedAmount / 10; // Rough estimate
      if (wsolAccount.amount < BigInt(minBalance)) {
        res.status(400).json({
          error: `Insufficient WSOL balance. Required: ~${minBalance / 1_000_000_000} WSOL, Available: ${Number(wsolAccount.amount) / 1_000_000_000} WSOL`,
        });
        return;
      }
    }


    const tx = await program.methods
      .buy(new anchor.BN(amount * 1_000_000_000)) // Assuming 9 decimals
      .accounts({
        bondingCurve: bondingCurvePda,
        tokenMint: new PublicKey(tokenMint),
        buyer,
        buyerTokenAccount,
        wsolMint: WSOL_MINT,
        buyerWsolAccount,
        bondingCurveWsolAccount,
        usingNativeSol: useNativeSol ? buyer : new PublicKey('11111111111111111111111111111111'), // Dummy key if not native SOL
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();

    console.log('BuyTokens ~ Transaction signature:', tx);

    res.status(200).json({ message: `Successfully bought ${amount} tokens` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to buy tokens', details: err.message });
  }
};

export const sellTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tokenMint, amount } = req.body;
    if (!tokenMint || !amount) {
      res.status(400).json({ error: 'Token mint and amount are required' });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than 0' });
      return;
    }

    // const seller = userA.publicKey; // Use userB as the seller
    const tokenMintPubkey = new PublicKey(tokenMint);
    const program = getProgram();
    const seller = program.provider.wallet!.publicKey;
    const [bondingCurvePda] = await getBondingCurvePda(new PublicKey(tokenMint));
    const sellerTokenAccount = await getAssociatedTokenAddress(seller, new PublicKey(tokenMint));
    const sellerWsolAccount = await getAssociatedTokenAddress(seller, WSOL_MINT);
    const bondingCurveWsolAccount = await getAssociatedTokenAddress(bondingCurvePda, WSOL_MINT);

    console.log('bondingCurvePda', bondingCurvePda.toString());
    console.log('sellerWsolAccount', sellerWsolAccount.toString());
    console.log('bondingCurveWsolAccount', bondingCurveWsolAccount.toString());
    console.log('sellerTokenAccount', sellerTokenAccount.toString());



    // Fetch bonding curve account to check current supply and WSOL balance
    let bondingCurveAccount;
    try {
      bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurvePda);
    } catch (error) {
      res.status(400).json({ error: 'Bonding curve account not found or invalid' });
      return;
    }

    const currentSupply = bondingCurveAccount.purchaseMarketSupply.toNumber();


    // Validate amount against current supply
    const requestedAmount = amount * 1_000_000_000; // Convert to base units (9 decimals)
    if (requestedAmount > currentSupply) {
      res.status(400).json({
        error: `Requested sell amount exceeds bonding curve supply. Max: ${currentSupply / 1_000_000_000} tokens`,
      });
      return;
    }

    // Check seller's token balance
    let sellerTokenBalance;
    try {
      const sellerTokenAccountInfo = await getAccount(connection, sellerTokenAccount);
      sellerTokenBalance = sellerTokenAccountInfo.amount;
      if (sellerTokenBalance < requestedAmount) {
        res.status(400).json({
          error: `Insufficient token balance. Required: ${amount} tokens, Available: ${Number(sellerTokenBalance) / 1_000_000_000} tokens`,
        });
        return;
      }
    } catch (error) {
      res.status(400).json({ error: 'Seller token account does not exist or is invalid' });
      return;
    }

    // Check bonding curve's WSOL balance
    let bondingCurveWsolBalance;
    try {
      const bondingCurveWsolAccountInfo = await getAccount(connection, bondingCurveWsolAccount);
      bondingCurveWsolBalance = bondingCurveWsolAccountInfo.amount;
    } catch (error) {
      res.status(400).json({ error: 'Bonding curve WSOL account does not exist' });
      return;
    }

    // Create seller's WSOL account if it doesn't exist
    try {
      await getAccount(connection, sellerWsolAccount);
    } catch (error) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          seller,
          sellerWsolAccount,
          seller,
          WSOL_MINT
        )
      );
      const signature = await program.provider.sendAndConfirm!(transaction);
      console.log('Created seller WSOL ATA, transaction signature:', signature);
    }


    // Create seller's token account if it doesn't exist (should exist, but for safety)
    try {
      await getAccount(connection, sellerTokenAccount);
    } catch (error) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          seller,
          sellerTokenAccount,
          seller,
          new PublicKey(tokenMint)
        )
      );
      const signature = await program.provider.sendAndConfirm!(transaction);
      console.log('Created seller token ATA, transaction signature:', signature);
    }




    const tx = await program.methods
      .sell(new anchor.BN(requestedAmount))
      .accounts({
        bondingCurve: bondingCurvePda,
        tokenMint: new PublicKey(tokenMint),
        seller,
        sellerTokenAccount,
        wsolMint: WSOL_MINT,
        sellerWsolAccount,
        bondingCurveWsolAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    console.log('Transaction signature:', tx);

    res.status(200).json({ message: `Successfully sold ${amount} tokens` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sell tokens', details: err.message });
  }
};

// export const swapTokens = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { tokenMintA, tokenMintB, amount } = req.body;
//     if (!tokenMintA || !tokenMintB || !amount || typeof amount !== 'number') {
//       res.status(400).json({ error: 'tokenMintA, tokenMintB, and amount (number) are required' });
//       return;
//     }

//     if (tokenMintA === tokenMintB) {
//       res.status(400).json({ error: 'tokenMintA and tokenMintB must be different' });
//       return;
//     }

//     if (amount <= 0) {
//       res.status(400).json({ error: 'Amount must be greater than 0' });
//       return;
//     }

//     const program = getProgram();
//     const connection = getConnection();
//     const swapper = program.provider.wallet!.publicKey;
//     const tokenMintAPubkey = new PublicKey(tokenMintA);
//     const tokenMintBPubkey = new PublicKey(tokenMintB);
//     const [bondingCurvePdaA] = await getBondingCurvePda(tokenMintAPubkey);
//     const [bondingCurvePdaB] = await getBondingCurvePda(tokenMintBPubkey);
//     const swapperTokenAccountA = await getAssociatedTokenAddress(swapper, tokenMintAPubkey);
//     const swapperTokenAccountB = await getAssociatedTokenAddress(swapper, tokenMintBPubkey);
//     const swapperWsolAccount = await getAssociatedTokenAddress(swapper, WSOL_MINT);
//     const bondingCurveWsolAccountA = await getAssociatedTokenAddress(bondingCurvePdaA, WSOL_MINT);
//     const bondingCurveWsolAccountB = await getAssociatedTokenAddress(bondingCurvePdaB, WSOL_MINT);

//     console.log('swapper:', swapper.toString());
//     console.log('bondingCurvePdaA:', bondingCurvePdaA.toString());
//     console.log('bondingCurvePdaB:', bondingCurvePdaB.toString());
//     console.log('swapperTokenAccountA:', swapperTokenAccountA.toString());
//     console.log('swapperTokenAccountB:', swapperTokenAccountB.toString());
//     console.log('swapperWsolAccount:', swapperWsolAccount.toString());
//     console.log('bondingCurveWsolAccountA:', bondingCurveWsolAccountA.toString());
//     console.log('bondingCurveWsolAccountB:', bondingCurveWsolAccountB.toString());


//     // Fetch bonding curve accounts
//     let bondingCurveAccountA, bondingCurveAccountB;
//     try {
//       bondingCurveAccountA = await program.account.bondingCurve.fetch(bondingCurvePdaA);
//       bondingCurveAccountB = await program.account.bondingCurve.fetch(bondingCurvePdaB);
//     } catch (error) {
//       res.status(400).json({ error: 'One or both bonding curve accounts not found or invalid' });
//       return;
//     }

//     const currentSupplyA = bondingCurveAccountA.purchaseMarketSupply.toNumber();
//     const currentSupplyB = bondingCurveAccountB.purchaseMarketSupply.toNumber();
//     console.log('Current supply A:', currentSupplyA / 1_000_000_000, 'tokens');
//     console.log('Current supply B:', currentSupplyB / 1_000_000_000, 'tokens');

//     // Validate amount against token A supply and swapper's balance
//     const requestedAmount = amount * 1_000_000_000; // Convert to base units (9 decimals)
//     if (requestedAmount > currentSupplyA) {
//       res.status(400).json({
//         error: `Requested swap amount exceeds bonding curve A supply. Max: ${currentSupplyA / 1_000_000_000} tokens`,
//       });
//       return;
//     }


//     // Check swapper's token A balance
//     let swapperTokenBalanceA;
//     try {
//       const swapperTokenAccountInfo = await getAccount(connection, swapperTokenAccountA);
//       swapperTokenBalanceA = Number(swapperTokenAccountInfo.amount);
//       if (swapperTokenBalanceA < requestedAmount) {
//         res.status(400).json({
//           error: `Insufficient token A balance. Required: ${amount} tokens, Available: ${swapperTokenBalanceA / 1_000_000_000} tokens`,
//         });
//         return;
//       }
//     } catch (error) {
//       res.status(400).json({ error: 'Swapper token A account does not exist. Acquire token A first.' });
//       return;
//     }


//     // Check bonding curve WSOL accounts
//     let bondingCurveWsolBalanceA, bondingCurveWsolBalanceB;
//     try {
//       const bondingCurveWsolAccountInfoA = await getAccount(connection, bondingCurveWsolAccountA);
//       bondingCurveWsolBalanceA = Number(bondingCurveWsolAccountInfoA.amount);
//       const bondingCurveWsolAccountInfoB = await getAccount(connection, bondingCurveWsolAccountB);
//       bondingCurveWsolBalanceB = Number(bondingCurveWsolAccountInfoB.amount);
//     } catch (error) {
//       res.status(400).json({ error: 'One or both bonding curve WSOL accounts do not exist' });
//       return;
//     }



//     // Estimate swap outcome
//     const sellPriceA = await calculateSellPrice(program, bondingCurvePdaA, requestedAmount);
//     const buyAmountB = await estimateBuyAmount(program, bondingCurvePdaB, sellPriceA);
//     if (sellPriceA <= 0 || buyAmountB <= 0) {
//       res.status(400).json({ error: 'Swap would result in zero output or insufficient WSOL' });
//       return;
//     }

//     if (sellPriceA > bondingCurveWsolBalanceA) {
//       res.status(400).json({
//         error: `Bonding curve A has insufficient WSOL. Required: ${sellPriceA / 1_000_000_000} WSOL, Available: ${bondingCurveWsolBalanceA / 1_000_000_000} WSOL`,
//       });
//       return;
//     }

//     // Create swapper's WSOL account if it doesn't exist
//     try {
//       await getAccount(connection, swapperWsolAccount);
//     } catch (error) {
//       const transaction = new Transaction().add(
//         createAssociatedTokenAccountInstruction(
//           swapper,
//           swapperWsolAccount,
//           swapper,
//           WSOL_MINT
//         )
//       );
//       const signature = await program.provider.sendAndConfirm!(transaction);
//       console.log('Created swapper WSOL ATA, transaction signature:', signature);
//     }

//     // Create swapper's token B account if it doesn't exist
//     try {
//       await getAccount(connection, swapperTokenAccountB);
//     } catch (error) {
//       const transaction = new Transaction().add(
//         createAssociatedTokenAccountInstruction(
//           swapper,
//           swapperTokenAccountB,
//           swapper,
//           tokenMintBPubkey
//         )
//       );
//       const signature = await program.provider.sendAndConfirm!(transaction);
//       console.log('Created swapper token B ATA, transaction signature:', signature);
//     }




//     // Execute the swap transaction
//     const tx = await program.methods
//       .swapTokens(new anchor.BN(requestedAmount))
//       .accounts({
//         bondingCurveA: bondingCurvePdaA,
//         bondingCurveB: bondingCurvePdaB,
//         tokenMintA: tokenMintAPubkey,
//         tokenMintB: tokenMintBPubkey,
//         swapper,
//         swapperTokenAccountA,
//         swapperTokenAccountB,
//         wsolMint: WSOL_MINT,
//         swapperWsolAccount,
//         bondingCurveWsolAccountA,
//         bondingCurveWsolAccountB,
//         tokenProgram: TOKEN_PROGRAM_ID,
//         associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//       }as any)
//       .rpc();

//     console.log('SwapTokens transaction signature:', tx);
//     res.status(200).json({
//       message: `Successfully swapped ${amount} token A for ~${buyAmountB / 1_000_000_000} token B`,
//       tx,
//       estimatedOutput: buyAmountB / 1_000_000_000,
//     });
//   } catch (err: any) {
//     console.error('Error in swapTokens:', err);
//     res.status(500).json({
//       error: 'Failed to swap tokens',
//       details: err.message,
//       logs: err.logs || [],
//     });
//   }
// };

export const swapTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceTokenMint, targetTokenMint, amountIn, minAmountOut } = req.body;
    if (!sourceTokenMint || !targetTokenMint || !amountIn || !minAmountOut) {
      res.status(400).json({ error: 'sourceTokenMint, targetTokenMint, amountIn, and minAmountOut are required' });
      return;
    }

    if (amountIn <= 0 || minAmountOut < 0) {
      res.status(400).json({ error: 'amountIn must be positive, and minAmountOut must be non-negative' });
      return;
    }

    const program = getProgram();
    const connection = getConnection();
    const user = program.provider.wallet!.publicKey;
    const sourceTokenMintPubkey = new PublicKey(sourceTokenMint);
    const targetTokenMintPubkey = new PublicKey(targetTokenMint);
    const [sourceBondingCurvePda] = await getBondingCurvePda(sourceTokenMintPubkey);
    const [targetBondingCurvePda] = await getBondingCurvePda(targetTokenMintPubkey);
    const [swapRouterPda] = await getSwapRouterPda();
    const userSourceTokenAccount = await getAssociatedTokenAddress(user, sourceTokenMintPubkey);
    const userTargetTokenAccount = await getAssociatedTokenAddress(user, targetTokenMintPubkey);
    const sourceBondingCurveWsolAccount = await getAssociatedTokenAddress(sourceBondingCurvePda, WSOL_MINT);
    const targetBondingCurveWsolAccount = await getAssociatedTokenAddress(targetBondingCurvePda, WSOL_MINT);

    console.log('user:', user.toString());
    console.log('sourceBondingCurvePda:', sourceBondingCurvePda.toString());
    console.log('targetBondingCurvePda:', targetBondingCurvePda.toString());
    console.log('swapRouterPda:', swapRouterPda.toString());
    console.log('userSourceTokenAccount:', userSourceTokenAccount.toString());
    console.log('userTargetTokenAccount:', userTargetTokenAccount.toString());

    // Fetch bonding curve accounts
    let sourceBondingCurveAccount;
    let targetBondingCurveAccount;
    try {
      sourceBondingCurveAccount = await program.account.bondingCurve.fetch(sourceBondingCurvePda);
      targetBondingCurveAccount = await program.account.bondingCurve.fetch(targetBondingCurvePda);
    } catch (error) {
      res.status(400).json({ error: 'Source or target bonding curve account not found or invalid' });
      return;
    }

    // Validate supply and balances
    const sourceSupply = sourceBondingCurveAccount.purchaseMarketSupply.toNumber();
    const targetSupply = targetBondingCurveAccount.purchaseMarketSupply.toNumber();
    const amountInLamports = amountIn * 1_000_000_000; // 9 decimals
    const minAmountOutLamports = minAmountOut * 1_000_000_000;

    if (amountInLamports > sourceSupply) {
      res.status(400).json({
        error: `Requested amountIn exceeds source bonding curve supply. Max: ${sourceSupply / 1_000_000_000} tokens`,
      });
      return;
    }


    // Check user's source token balance
    let userSourceTokenBalance;
    try {
      const userSourceTokenAccountInfo = await getAccount(connection, userSourceTokenAccount);
      userSourceTokenBalance = Number(userSourceTokenAccountInfo.amount);
      if (userSourceTokenBalance < amountInLamports) {
        res.status(400).json({
          error: `Insufficient source token balance. Required: ${amountIn} tokens, Available: ${userSourceTokenBalance / 1_000_000_000} tokens`,
        });
        return;
      }
    } catch (error) {
      res.status(400).json({ error: 'User source token account does not exist. Acquire source tokens first.' });
      return;
    }

    // Check source bonding curve WSOL balance
    let sourceBondingCurveWsolBalance;
    try {
      const sourceBondingCurveWsolAccountInfo = await getAccount(connection, sourceBondingCurveWsolAccount);
      sourceBondingCurveWsolBalance = Number(sourceBondingCurveWsolAccountInfo.amount);
    } catch (error) {
      res.status(400).json({ error: 'Source bonding curve WSOL account does not exist or is empty' });
      return;
    }

    // Estimate swap price
    const { solAmount, expectedAmountOut } = await estimateSwapPrice(
      program,
      sourceBondingCurvePda,
      targetBondingCurvePda,
      amountInLamports
    );

    if (sourceBondingCurveWsolBalance < solAmount) {
      res.status(400).json({
        error: `Source bonding curve has insufficient WSOL. Required: ${solAmount / 1_000_000_000} WSOL, Available: ${sourceBondingCurveWsolBalance / 1_000_000_000} WSOL`,
      });
      return;
    }

    if (expectedAmountOut < minAmountOutLamports) {
      res.status(400).json({
        error: `Expected output (${expectedAmountOut / 1_000_000_000} tokens) is below minAmountOut (${minAmountOut} tokens)`,
      });
      return;
    }



    // Create user target token account if it doesn't exist
    try {
      await getAccount(connection, userTargetTokenAccount);
    } catch (error) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          user,
          userTargetTokenAccount,
          user,
          targetTokenMintPubkey
        )
      );
      const signature = await program.provider.sendAndConfirm!(transaction);
      console.log('Created user target token ATA, transaction signature:', signature);
    }

    // Execute swap transaction
    const tx = await program.methods
      .swapTokens(new anchor.BN(amountInLamports), new anchor.BN(minAmountOutLamports))
      .accounts({
        swapRouter: swapRouterPda,
        sourceBondingCurve: sourceBondingCurvePda,
        sourceTokenMint: sourceTokenMintPubkey,
        targetBondingCurve: targetBondingCurvePda,
        targetTokenMint: targetTokenMintPubkey,
        user,
        userSourceTokenAccount,
        userTargetTokenAccount,
        sourceBondingCurveWsolAccount,
        targetBondingCurveWsolAccount,
        wsolMint: WSOL_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    console.log('SwapTokens transaction signature:', tx);
    res.status(200).json({
      message: `Successfully swapped ${amountIn} source tokens for ~${expectedAmountOut / 1_000_000_000} target tokens`,
      tx,
      solAmount: solAmount / 1_000_000_000,
      expectedAmountOut: expectedAmountOut / 1_000_000_000,
    });
  } catch (err: any) {
    console.error('Error in swapTokens:', err);
    res.status(500).json({
      error: 'Failed to swap tokens',
      details: err.message,
      logs: err.logs || [],
    });
  }
};

// Helper function to estimate swap price
async function estimateSwapPrice(
  program: any,
  sourceBondingCurvePda: PublicKey,
  targetBondingCurvePda: PublicKey,
  amountIn: number
): Promise<{ solAmount: number; expectedAmountOut: number }> {
  const sourceBondingCurve = await program.account.bondingCurve.fetch(sourceBondingCurvePda);
  const targetBondingCurve = await program.account.bondingCurve.fetch(targetBondingCurvePda);

  const sourceSupply = sourceBondingCurve.purchaseMarketSupply.toNumber();
  const sourceFeePercent = sourceBondingCurve.sellFeePercent;
  const sourceInitialPrice = sourceBondingCurve.initialPrice.toNumber();
  const targetSupply = targetBondingCurve.purchaseMarketSupply.toNumber();
  const targetFeePercent = targetBondingCurve.buyFeePercent;
  const targetInitialPrice = targetBondingCurve.initialPrice.toNumber();
  const VIRTUAL_RESERVE_SOL = 500_000_000;
  const VIRTUAL_TOKEN_SUPPLY = 10_000_000_000_000_000;

  // Calculate SOL from selling source tokens
  const priceAtSourceSupply = calculatePriceAtSupply(sourceSupply, sourceInitialPrice);
  const priceAtSourceFinal = calculatePriceAtSupply(sourceSupply - amountIn, sourceInitialPrice);
  const rawSolPrice = ((priceAtSourceSupply + priceAtSourceFinal) * amountIn) / 2 / 1_000_000_000;
  const sourceFee = (rawSolPrice * sourceFeePercent) / 10000;
  const solAmount = rawSolPrice > sourceFee ? rawSolPrice - sourceFee : 0;

  // Calculate target tokens bought with SOL
  const adjustedSol = (solAmount * 10000) / (10000 + targetFeePercent);
  const currentSol = VIRTUAL_RESERVE_SOL + (targetSupply * targetInitialPrice) / 1_000_000_000;
  const newSol = currentSol + adjustedSol;
  const currentTokens = VIRTUAL_TOKEN_SUPPLY - targetSupply;
  const newTokens = (currentTokens * currentSol) / newSol;
  const expectedAmountOut = (currentTokens - newTokens) * 1_000_000_000; // Adjust for decimals

  return { solAmount, expectedAmountOut };
}

function calculatePriceAtSupply(supply: number, initialPrice: number): number {
  const VIRTUAL_RESERVE_SOL = 500_000_000;
  const VIRTUAL_TOKEN_SUPPLY = 10_000_000_000_000_000;

  const currentSol = VIRTUAL_RESERVE_SOL + (supply * initialPrice) / 1_000_000_000;
  const remainingSupply = supply >= VIRTUAL_TOKEN_SUPPLY ? 1 : VIRTUAL_TOKEN_SUPPLY - supply;
  const price = (currentSol * VIRTUAL_TOKEN_SUPPLY) / remainingSupply;
  return price / 1_000_000_000;
}

export const initializeSwapRouter = async (req: Request, res: Response): Promise<void> => {
  try {
    const program = getProgram();
    const [swapRouterPda] = await getSwapRouterPda();

    const tx = await program.methods
      .initializeSwapRouter()
      .accounts({
        swapRouter: swapRouterPda,
        authority: program.provider.wallet!.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    console.log('InitializeSwapRouter transaction signature:', tx);
    res.status(200).json({
      message: 'Swap router initialized successfully',
      swapRouter: swapRouterPda.toString(),
      tx,
    });
  } catch (err: any) {
    console.error('Error in initializeSwapRouter:', err);
    res.status(500).json({
      error: 'Failed to initialize swap router',
      details: err.message,
      logs: err.logs || [],
    });
  }
};

// Helper function to calculate sell price (mirrors program's calculate_token_sell_price)
async function calculateSellPrice(program: any, bondingCurvePda: PublicKey, amount: number): Promise<number> {
  const bondingCurve = await program.account.bondingCurve.fetch(bondingCurvePda);
  const supply = bondingCurve.purchaseMarketSupply.toNumber();
  const feePercent = bondingCurve.sellFeePercent;
  const initialPrice = bondingCurve.initialPrice.toNumber();
  const VIRTUAL_RESERVE_SOL = 500_000_000;
  const VIRTUAL_TOKEN_SUPPLY = 10_000_000_000_000_000;

  if (amount > supply) {
    return 0; // Cannot sell more than available
  }

  const priceAtSupply = calculatePriceAtSupply(supply, initialPrice);
  const priceAtFinal = calculatePriceAtSupply(supply - amount, initialPrice);
  const rawPrice = ((priceAtSupply + priceAtFinal) * amount) / 2 / 1_000_000_000; // Adjust for decimals
  const fee = (rawPrice * feePercent) / 10000;
  return rawPrice > fee ? rawPrice - fee : 0;
}

// Helper function to estimate buy amount (inverse of calculate_buy_price)
async function estimateBuyAmount(program: any, bondingCurvePda: PublicKey, solAmount: number): Promise<number> {
  const bondingCurve = await program.account.bondingCurve.fetch(bondingCurvePda);
  const supply = bondingCurve.purchaseMarketSupply.toNumber();
  const feePercent = bondingCurve.buyFeePercent;
  const initialPrice = bondingCurve.initialPrice.toNumber();
  const VIRTUAL_RESERVE_SOL = 500_000_000;
  const VIRTUAL_TOKEN_SUPPLY = 10_000_000_000_000_000;

  const solAfterFee = (solAmount * 10000) / (10000 + feePercent); // Remove fee
  const currentSol = VIRTUAL_RESERVE_SOL + (supply * initialPrice) / 1_000_000_000;
  const newSol = currentSol + solAfterFee;
  const newSupply = VIRTUAL_TOKEN_SUPPLY - (currentSol * VIRTUAL_TOKEN_SUPPLY) / newSol;
  return newSupply - supply; // Tokens received
}


// export const distributeTokens = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { tokenMint, recipients, amounts } = req.body;
//     if (!tokenMint || !recipients || !amounts || recipients.length !== amounts.length) {
//       res.status(400).json({ error: 'Token mint, recipients, and amounts are required and must match in length' });
//       return;
//     }

//     const program = getProgram();
//     const [supporterContractPda] = await getSupporterContractPda(new PublicKey(tokenMint));
//     const supporterTokenAccount = await getAssociatedTokenAddress(supporterContractPda, new PublicKey(tokenMint));

//     for (let i = 0; i < recipients.length; i++) {
//       const recipient = new PublicKey(recipients[i]);
//       const recipientTokenAccount = await getAssociatedTokenAddress(recipient, new PublicKey(tokenMint));

//       const tx = await program.methods
//         .distributeTokens(
//           recipients.map((r: string) => new PublicKey(r)),
//           amounts.map((a: number) => new anchor.BN(a * 1_000_000_000))
//         )
//         .accounts({
//           supporterContract: supporterContractPda,
//           supporterTokenAccount,
//           tokenMint: new PublicKey(tokenMint),
//           recipient,
//           recipientTokenAccount,
//           signer: program.provider.wallet!.publicKey,
//           tokenProgram: TOKEN_PROGRAM_ID,
//           associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//           systemProgram: SystemProgram.programId,
//         } as any)
//         .rpc();

//       console.log('Transaction signature:', tx);
//     }

//     res.status(200).json({ message: 'Tokens distributed successfully' });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to distribute tokens', details: err.message });
//   }
// };

// export const distributeWithSignature = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { tokenMint, dataHash, signature, recipients, amounts } = req.body;
//     if (!tokenMint || !dataHash || !signature || !recipients || !amounts || recipients.length !== amounts.length) {
//       res.status(400).json({ error: 'All fields are required and recipients/amounts must match in length' });
//       return;
//     }

//     const program = getProgram();
//     const [supporterContractPda] = await getSupporterContractPda(new PublicKey(tokenMint));
//     const supporterTokenAccount = await getAssociatedTokenAddress(supporterContractPda, new PublicKey(tokenMint));
//     const [signaturePda] = await getSignaturePda(Buffer.from(dataHash, 'hex'));

//     for (let i = 0; i < recipients.length; i++) {
//       const recipient = new PublicKey(recipients[i]);
//       const recipientTokenAccount = await getAssociatedTokenAddress(recipient, new PublicKey(tokenMint));

//       const tx = await program.methods
//         .distributeWithSignature(
//           Array.from(Buffer.from(dataHash, 'hex')),
//           Array.from(Buffer.from(signature, 'hex')),
//           recipients.map((r: string) => new PublicKey(r)),
//           amounts.map((a: number) => new anchor.BN(a * 1_000_000_000))
//         )
//         .accounts({
//           supporterContract: supporterContractPda,
//           supporterTokenAccount,
//           tokenMint: new PublicKey(tokenMint),
//           recipient,
//           recipientTokenAccount,
//           signatureAccount: signaturePda,
//           payer: program.provider.wallet!.publicKey,
//           tokenProgram: TOKEN_PROGRAM_ID,
//           associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//           systemProgram: SystemProgram.programId,
//         } as any)
//         .rpc();
//       console.log('Transaction signature:', tx);
//     }

//     res.status(200).json({ message: 'Tokens distributed with signature successfully' });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to distribute tokens with signature', details: err.message });
//   }
// };

// export const provideLiquidity = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { tokenMint, amount } = req.body;
//     if (!tokenMint || !amount) {
//       res.status(400).json({ error: 'Token mint and amount are required' });
//       return;
//     }

//     const program = getProgram();
//     const [bondingCurvePda] = await getBondingCurvePda(new PublicKey(tokenMint));
//     const providerTokenAccount = await getAssociatedTokenAddress(program.provider.wallet!.publicKey, new PublicKey(tokenMint));
//     const curveTokenAccount = await getAssociatedTokenAddress(bondingCurvePda, new PublicKey(tokenMint));

//     const tx = await program.methods
//       .provideLiquidity(new anchor.BN(amount * 1_000_000_000))
//       .accounts({
//         bondingCurve: bondingCurvePda,
//         tokenMint: new PublicKey(tokenMint),
//         provider: program.provider.wallet!.publicKey,
//         providerTokenAccount,
//         curveTokenAccount,
//         tokenProgram: TOKEN_PROGRAM_ID,
//         associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//       } as any)
//       .rpc();

//     console.log('Transaction signature:', tx);

//     res.status(200).json({ message: `Successfully provided ${amount} tokens as liquidity` });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to provide liquidity', details: err.message });
//   }
// };

// export const updateBondingCurve = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { tokenMint, reserveRatio, initialPrice } = req.body;
//     if (!tokenMint || !reserveRatio || !initialPrice) {
//       res.status(400).json({ error: 'Token mint, reserve ratio, and initial price are required' });
//       return;
//     }

//     const program = getProgram();
//     const [bondingCurvePda] = await getBondingCurvePda(new PublicKey(tokenMint));
//     const [creatorTokenPda] = await getCreatorTokenPda(createHash('sha256').update(tokenMint).digest());

//     const tx = await program.methods
//       .updateBondingCurve(new anchor.BN(reserveRatio), new anchor.BN(initialPrice))
//       .accounts({
//         bondingCurve: bondingCurvePda,
//         creatorTokenAccount: creatorTokenPda,
//         creator: program.provider.wallet!.publicKey,
//         systemProgram: SystemProgram.programId,
//       } as any)
//       .rpc();

//     console.log('Transaction signature:', tx);

//     res.status(200).json({ message: 'Bonding curve updated successfully' });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to update bonding curve', details: err.message });
//   }
// };

// export const withdraw = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { tokenMint } = req.body;
//     if (!tokenMint) {
//       res.status(400).json({ error: 'Token mint is required' });
//       return;
//     }

//     const program = getProgram();
//     const [selfTokenVaultPda] = await getSelfTokenVaultPda(new PublicKey(tokenMint));
//     const vaultTokenAccount = await getAssociatedTokenAddress(selfTokenVaultPda, new PublicKey(tokenMint));
//     const creatorTokenAccount = await getAssociatedTokenAddress(program.provider.wallet!.publicKey, new PublicKey(tokenMint));

//     const tx = await program.methods
//       .withdraw()
//       .accounts({
//         selfTokenVault: selfTokenVaultPda,
//         vaultTokenAccount,
//         creatorTokenAccount,
//         tokenMint: new PublicKey(tokenMint),
//         creator: program.provider.wallet!.publicKey,
//         tokenProgram: TOKEN_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//       } as any)
//       .rpc();

//     console.log('Transaction signature:', tx);

//     res.status(200).json({ message: 'Tokens withdrawn successfully' });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to withdraw tokens', details: err.message });
//   }
// };

// export const withdrawFees = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { tokenMint } = req.body;
//     if (!tokenMint) {
//       res.status(400).json({ error: 'Token mint is required' });
//       return;
//     }

//     const program = getProgram();
//     const [bondingCurvePda] = await getBondingCurvePda(new PublicKey(tokenMint));

//     const tx = await program.methods
//       .withdrawFees()
//       .accounts({
//         bondingCurve: bondingCurvePda,
//         caller: program.provider.wallet!.publicKey,
//         feeAddress: PROTOCOL_FEE_ADDRESS,
//         systemProgram: SystemProgram.programId,
//       } as any)
//       .rpc();

//     console.log('Transaction signature:', tx);

//     res.status(200).json({ message: 'Fees withdrawn successfully' });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to withdraw fees', details: err.message });
//   }
// };

export const setAiAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agent, allowed } = req.body;
    if (!agent || allowed === undefined) {
      res.status(400).json({ error: 'Agent and allowed status are required' });
      return;
    }

    const program = getProgram();
    const [entryPointPda] = await getEntryPointPda();
    const [agentPda] = await getAiAgentPda(new PublicKey(agent));

    const tx = await program.methods
      .setAiAgent(new PublicKey(agent), allowed)
      .accounts({
        entryPoint: entryPointPda,
        agentAccount: agentPda,
        authority: program.provider.wallet!.publicKey,
        agent: new PublicKey(agent),
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    console.log('Transaction signature:', tx);

    res.status(200).json({ message: 'AI agent status updated successfully' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to set AI agent', details: err.message });
  }
};

// export const dripTokens = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { tokenMint, distributionPool } = req.body;
//     if (!tokenMint || !distributionPool) {
//       res.status(400).json({ error: 'Token mint and distribution pool are required' });
//       return;
//     }

//     const program = getProgram();
//     const [supporterContractPda] = await getSupporterContractPda(new PublicKey(tokenMint));
//     const supporterTokenAccount = await getAssociatedTokenAddress(supporterContractPda, new PublicKey(tokenMint));
//     const [globalEntryPointPda] = await getEntryPointPda();

//     const tx = await program.methods
//       .dripTokens()
//       .accounts({
//         supporterContract: supporterContractPda,
//         supporterTokenAccount,
//         distributionPool: new PublicKey(distributionPool),
//         aiAgent: AI_AGENT_ADDRESS,
//         globalEntryPoint: globalEntryPointPda,
//         tokenProgram: TOKEN_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//       } as any)
//       .rpc();

//     console.log('Transaction signature:', tx);

//     res.status(200).json({ message: 'Tokens dripped successfully' });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to drip tokens', details: err.message });
//   }
// };

// export const availableForWithdrawal = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { tokenMint } = req.body;
//     if (!tokenMint) {
//       res.status(400).json({ error: 'Token mint is required' });
//       return;
//     }

//     const program = getProgram();
//     const [selfTokenVaultPda] = await getSelfTokenVaultPda(new PublicKey(tokenMint));

//     const amount = await program.methods
//       .availableForWithdrawal()
//       .accounts({
//         selfTokenVault: selfTokenVaultPda,
//       })
//       .view();

//     console.log('Available for withdrawal:', amount.toString());

//     res.status(200).json({ message: 'Available tokens retrieved', amount: amount.toString() });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to get available tokens', details: err.message });
//   }
// };

// export const getHandleHash = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { username } = req.body;
//     if (!username) {
//       res.status(400).json({ error: 'Username is required' });
//       return;
//     }

//     const program = getProgram();

//     const tx = await program.methods
//       .getHandleHash(username)
//       .accounts({
//         signer: program.provider.wallet!.publicKey,
//       } as any)
//       .rpc();

//     console.log('Transaction signature:', tx);

//     const handleHash = createHash('sha256').update(username).digest();
//     res.status(200).json({ message: 'Handle hash retrieved', hash: Buffer.from(handleHash).toString('hex') });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to get handle hash', details: err.message });
//   }
// };

// export const getTokensForSol = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { tokenMint, solAmount } = req.body;
//     if (!tokenMint || !solAmount) {
//       res.status(400).json({ error: 'Token mint and SOL amount are required' });
//       return;
//     }

//     const program = getProgram();
//     const [bondingCurvePda] = await getBondingCurvePda(new PublicKey(tokenMint));
//     console.log('bondingCurvePda', bondingCurvePda.toString());

//     const tokenAmount = await program.methods
//       .getTokensForSol(new anchor.BN(solAmount))
//       .accounts({
//         bondingCurve: bondingCurvePda,
//         tokenMint: new PublicKey(tokenMint),
//       })
//       .view();

//     console.log('getTokensForSol ~ Token amount:', tokenAmount.toString());

//     res.status(200).json({ message: 'Token amount retrieved', tokenAmount: tokenAmount.toString() });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to get tokens for SOL', details: err.message });
//   }
// };

// export const getSolForTokens = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { tokenMint, tokenAmount } = req.body;
//     if (!tokenMint || !tokenAmount) {
//       res.status(400).json({ error: 'Token mint and token amount are required' });
//       return;
//     }

//     const program = getProgram();
//     const [bondingCurvePda] = await getBondingCurvePda(new PublicKey(tokenMint));

//     const solAmount = await program.methods
//       .getSolForTokens(new anchor.BN(tokenAmount * 1_000_000_000))
//       .accounts({
//         bondingCurve: bondingCurvePda,
//         tokenMint: new PublicKey(tokenMint),
//       })
//       .view();

//     console.log('SOL amount:', solAmount.toString());

//     res.status(200).json({ message: 'SOL amount retrieved', solAmount: solAmount.toString() });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to get SOL for tokens', details: err.message });
//   }
// };