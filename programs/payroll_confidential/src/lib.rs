use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::hash::hash;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_spl::token::spl_token::native_mint::ID as WRAPPED_SOL_MINT;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};
use borsh::BorshDeserialize;
/**
 * @title Attenomics Creator Tokens
 * @notice Implementation of Creator Tokens for the Attenomics protocol on Solana
 *
 * This program provides the infrastructure for social tokens tied to creators,
 * featuring bonding curve mechanics, token vesting, and supporter distribution.
 *
 * Core components:
 * - Entry point for registration and deployment
 * - Self Token Vault for creator token vesting
 * - Bonding Curve for token price discovery
 * - Swap Router for token-to-token swaps
 * - Creator Token Supporter for community distributions
 */
use std::mem::size_of;

// Program ID for the Attenomics Creator Tokens program
declare_id!("BwzroF85PpoMMjmvYBgvdtXRggJUNUs6sfw6LydFjTEj");

#[program]
pub mod solana {
    use super::*;

    /**
     * @notice Initializes the Attenomics Creator Tokens entry point
     * @param protocol_fee_address The address that will receive protocol fees
     *
     * This function sets up the global entry point for the protocol that tracks
     * registered AI agents, creator tokens, and handles protocol-wide configuration.
     */
    pub fn initialize(ctx: Context<Initialize>, protocol_fee_address: Pubkey) -> Result<()> {
        let entry_point: &mut Account<'_, AttenomicsEntryPoint> = &mut ctx.accounts.entry_point;
        entry_point.authority = ctx.accounts.authority.key();
        entry_point.gaslite_drop_address = ctx.accounts.gaslite_drop.key();
        entry_point.protocol_fee_address = protocol_fee_address;
        entry_point.next_token_id = 0;

        msg!("AttenomicsCreatorEntryPoint initialized");
        Ok(())
    }

    /**
     * @notice Registers or updates an AI agent's permission status
     * @param agent The public key of the AI agent to register
     * @param allowed Whether the agent is allowed to interact with the protocol
     *
     * Only the protocol authority can register AI agents. Registered agents
     * can perform privileged actions like distributing tokens to supporters.
     */
    pub fn set_ai_agent(ctx: Context<SetAiAgent>, agent: Pubkey, allowed: bool) -> Result<()> {
        // Only the authority can register AI agents
        require!(
            ctx.accounts.authority.key() == ctx.accounts.entry_point.authority,
            AttenomicsError::Unauthorized
        );

        // Store the AI agent status in PDA
        let agent_account = &mut ctx.accounts.agent_account;
        agent_account.agent = agent;
        agent_account.allowed = allowed;

        emit!(AIAgentUpdated { agent, allowed });

        Ok(())
    }

    pub fn deploy_creator_token(
        ctx: Context<DeployCreatorToken>,
        config: TokenConfig,
        distributor_config_bytes: Vec<u8>,
        vault_config_bytes: Vec<u8>,
        name: String,
        symbol: String,
        nft_metadata_uri: String,
    ) -> Result<()> {
        // Validate configuration
        require!(
            config.self_percent + config.market_percent + config.supporter_percent == 100,
            AttenomicsError::InvalidPercentageSplit
        );
        require!(name.len() <= 32, AttenomicsError::InvalidInput);
        require!(symbol.len() <= 10, AttenomicsError::InvalidInput);
        require!(nft_metadata_uri.len() <= 200, AttenomicsError::InvalidInput);

        // Check if handle already exists
        let creator_token_account = &ctx.accounts.creator_token_account;
        require!(
            !creator_token_account.initialized,
            AttenomicsError::HandleAlreadyUsed
        );

        // Check if the AI agent is allowed
        let agent_allowed = ctx.accounts.ai_agent_account.allowed;
        require!(agent_allowed, AttenomicsError::AIAgentNotAllowed);

        // Update the NFT records
        let entry_point = &mut ctx.accounts.entry_point;
        let token_id = entry_point.next_token_id;
        entry_point.next_token_id += 1;

        // Deserialize configurations
        let vault_config: VaultConfig = VaultConfig::try_from_slice(&vault_config_bytes)
            .map_err(|_| AttenomicsError::InvalidVaultConfig)?;
        let distributor_config: DistributorConfig =
            DistributorConfig::try_from_slice(&distributor_config_bytes)
                .map_err(|_| AttenomicsError::InvalidDistributorConfig)?;

        // Validate distributor config
        require!(
            distributor_config.daily_drip_amount > 0
                && distributor_config.drip_interval > 0
                && distributor_config.total_days > 0,
            AttenomicsError::InvalidDistributorConfig
        );

        // let total_distribution =
        //     distributor_config.daily_drip_amount * distributor_config.total_days as u64;
        // require!(
        //     total_distribution <= (config.total_supply * config.supporter_percent as u64) / 100,
        //     AttenomicsError::InvalidDistributorConfig
        // );

        //calculate token allocation direclty
        let supporter_allocation = (config.total_supply * config.supporter_percent as u128) / 100;

        // calculate self token allocation directly
        let daily_drip = distributor_config.daily_drip_amount as u128;
        let total_days = distributor_config.total_days as u128;
        let total_distribution = daily_drip * total_days;

        // Validate distribution doesn't exceed allocation
        require!(
            total_distribution <= supporter_allocation,
            AttenomicsError::InvalidDistributorConfig
        );

        // Initialize accounts
        let creator_token = &mut ctx.accounts.creator_token_account;
        creator_token.handle = config.handle;
        creator_token.creator = ctx.accounts.creator.key();
        creator_token.token_mint = ctx.accounts.token_mint.key();
        creator_token.ai_agent = config.ai_agent;
        creator_token.total_supply = config.total_supply;
        creator_token.self_percent = config.self_percent;
        creator_token.market_percent = config.market_percent;
        creator_token.supporter_percent = config.supporter_percent;
        creator_token.token_id = token_id;
        creator_token.name = name;
        creator_token.symbol = symbol;
        creator_token.nft_metadata_uri = nft_metadata_uri.clone();
        creator_token.self_token_vault = ctx.accounts.self_token_vault.key();
        creator_token.bonding_curve = ctx.accounts.bonding_curve.key();
        creator_token.supporter_contract = ctx.accounts.supporter_contract.key();
        creator_token.initialized = true;

        let self_tokens = (config.total_supply * config.self_percent as u128) / 100;
        let supporter_tokens = (config.total_supply * config.supporter_percent as u128) / 100;

        let self_vault = &mut ctx.accounts.self_token_vault;
        self_vault.token_mint = ctx.accounts.token_mint.key();
        self_vault.creator = ctx.accounts.creator.key();
        self_vault.initial_balance = self_tokens;
        self_vault.withdrawn = 0;
        self_vault.start_time = Clock::get()?.unix_timestamp;
        self_vault.initialized = true;
        self_vault.vault_config = vault_config;

        let bonding_curve = &mut ctx.accounts.bonding_curve;
        bonding_curve.token_mint = ctx.accounts.token_mint.key();
        bonding_curve.protocol_fee_address = entry_point.protocol_fee_address;
        bonding_curve.buy_fee_percent = 50;
        bonding_curve.sell_fee_percent = 50;
        bonding_curve.purchase_market_supply = 0;
        bonding_curve.lifetime_protocol_fees = 0;
        bonding_curve.reserve_ratio = 1_000_000;
        bonding_curve.initial_price = 1;

        let supporter = &mut ctx.accounts.supporter_contract;
        supporter.token_mint = ctx.accounts.token_mint.key();
        supporter.ai_agent = config.ai_agent;
        supporter.gaslite_drop_address = entry_point.gaslite_drop_address;
        supporter.total_distributed = 0;
        supporter.distributor_config = distributor_config;

        let nft_account = &mut ctx.accounts.nft_account;
        nft_account.owner = ctx.accounts.creator.key();
        nft_account.token_id = token_id;
        nft_account.metadata_uri = nft_metadata_uri;
        nft_account.creator_token = ctx.accounts.creator_token_account.key();

        emit!(CreatorTokenDeployed {
            creator: ctx.accounts.creator.key(),
            token_address: ctx.accounts.token_mint.key(),
            handle: config.handle,
            token_id,
        });

        Ok(())
    }

    pub fn mint_initial_tokens(ctx: Context<MintInitialTokens>) -> Result<()> {
        let creator_token = &ctx.accounts.creator_token_account;
        let self_tokens_u128 =
            (creator_token.total_supply * creator_token.self_percent as u128) / 100;
        let supporter_tokens_u128 =
            (creator_token.total_supply * creator_token.supporter_percent as u128) / 100;

        // Convert to u64 for minting (will fail if overflow)
        let self_tokens = if self_tokens_u128 <= u64::MAX as u128 {
            self_tokens_u128 as u64
        } else {
            return Err(AttenomicsError::ArithmeticError.into());
        };

        let supporter_tokens = if supporter_tokens_u128 <= u64::MAX as u128 {
            supporter_tokens_u128 as u64
        } else {
            return Err(AttenomicsError::ArithmeticError.into());
        };

        let token_mint_key = ctx.accounts.token_mint.key();
        let bonding_curve_seeds = &[
            b"bonding-curve",
            token_mint_key.as_ref(),
            &[ctx.bumps.bonding_curve],
        ];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[bonding_curve_seeds],
            ),
            self_tokens,
        )?;

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.supporter_token_account.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[bonding_curve_seeds],
            ),
            supporter_tokens,
        )?;

        msg!(
            "Minted {} tokens to SelfTokenVault and {} to CreatorTokenSupporter",
            self_tokens,
            supporter_tokens
        );

        Ok(())
    }

    // pub fn get_handle_hash(_ctx: Context<GetHandleHash>, username: String) -> Result<()> {
    //     let hash_result = hash(username.as_bytes());
    //     msg!("Handle hash: {:?}", hash_result);
    //     Ok(())
    // }

    // pub fn available_for_withdrawal(ctx: Context<AvailableForWithdrawal>) -> Result<u64> {
    //     let vault = &ctx.accounts.self_token_vault;
    //     if !vault.initialized {
    //         return Ok(0);
    //     }

    //     // Verify the balance (in a real implementation, check token account balance)
    //     let current_balance = vault.initial_balance;
    //     if current_balance < vault.initial_balance {
    //         return Ok(0);
    //     }

    //     // Immediate portion is the tokens not subject to vesting
    //     let immediate_release =
    //         (vault.initial_balance * (100 - vault.vault_config.locked_percentage) as u64) / 100;

    //     let mut vested = 0;
    //     let current_time = Clock::get()?.unix_timestamp;

    //     // Vesting only starts after the lock period
    //     if current_time > vault.start_time + vault.vault_config.lock_time {
    //         // Calculate how many full intervals have passed since vesting began
    //         let intervals = ((current_time - (vault.start_time + vault.vault_config.lock_time))
    //             / vault.vault_config.drip_interval) as u64;
    //         let locked_amount =
    //             (vault.initial_balance * vault.vault_config.locked_percentage as u64) / 100;
    //         // Amount vested per interval
    //         let per_interval = (locked_amount * vault.vault_config.drip_percentage as u64) / 100;
    //         vested = intervals * per_interval;
    //         if vested > locked_amount {
    //             vested = locked_amount;
    //         }
    //     }

    //     // Total tokens available for withdrawal
    //     let mut total_available = immediate_release + vested;
    //     if total_available > vault.initial_balance {
    //         total_available = vault.initial_balance;
    //     }

    //     // Subtract tokens already withdrawn
    //     if total_available > vault.withdrawn {
    //         Ok(total_available - vault.withdrawn)
    //     } else {
    //         Ok(0)
    //     }
    // }

    // pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
    //     // Calculate available tokens directly here instead of trying to reuse the instruction
    //     let vault = &ctx.accounts.self_token_vault;

    //     if !vault.initialized {
    //         return Err(AttenomicsError::NoTokensAvailable.into());
    //     }

    //     // Verify the balance (in a real implementation, check token account balance)
    //     let current_balance = vault.initial_balance;
    //     if current_balance < vault.initial_balance {
    //         return Err(AttenomicsError::NoTokensAvailable.into());
    //     }

    //     // Immediate portion is the tokens not subject to vesting
    //     let immediate_release =
    //         (vault.initial_balance * (100 - vault.vault_config.locked_percentage) as u64) / 100;

    //     let mut vested = 0;
    //     let current_time = Clock::get()?.unix_timestamp;

    //     // Vesting only starts after the lock period
    //     if current_time > vault.start_time + vault.vault_config.lock_time {
    //         // Calculate how many full intervals have passed since vesting began
    //         let intervals = ((current_time - (vault.start_time + vault.vault_config.lock_time))
    //             / vault.vault_config.drip_interval) as u64;
    //         let locked_amount =
    //             (vault.initial_balance * vault.vault_config.locked_percentage as u64) / 100;
    //         // Amount vested per interval
    //         let per_interval = (locked_amount * vault.vault_config.drip_percentage as u64) / 100;
    //         vested = intervals * per_interval;
    //         if vested > locked_amount {
    //             vested = locked_amount;
    //         }
    //     }

    //     // Total tokens available for withdrawal
    //     let mut total_available = immediate_release + vested;
    //     if total_available > vault.initial_balance {
    //         total_available = vault.initial_balance;
    //     }

    //     // Subtract tokens already withdrawn
    //     let available = if total_available > vault.withdrawn {
    //         total_available - vault.withdrawn
    //     } else {
    //         0
    //     };

    //     require!(available > 0, AttenomicsError::NoTokensAvailable);

    //     // Update withdrawn amount
    //     let vault = &mut ctx.accounts.self_token_vault;
    //     vault.withdrawn += available;

    //     // Create proper binding for the bump
    //     let bump = ctx.bumps.self_token_vault;

    //     // Transfer tokens from vault to creator
    //     token::transfer(
    //         CpiContext::new_with_signer(
    //             ctx.accounts.token_program.to_account_info(),
    //             token::Transfer {
    //                 from: ctx.accounts.vault_token_account.to_account_info(),
    //                 to: ctx.accounts.creator_token_account.to_account_info(),
    //                 authority: ctx.accounts.self_token_vault.to_account_info(),
    //             },
    //             &[&[
    //                 b"self-token-vault",
    //                 ctx.accounts.token_mint.key().as_ref(),
    //                 &[bump],
    //             ]],
    //         ),
    //         available,
    //     )?;

    //     Ok(())
    // }

    pub fn buy(ctx: Context<Buy>, amount: u64) -> Result<()> {
        // Get parameter values first before mutable borrows
        let purchase_market_supply = ctx.accounts.bonding_curve.purchase_market_supply;
        let buy_fee_percent = ctx.accounts.bonding_curve.buy_fee_percent;
        let protocol_fee_address = ctx.accounts.bonding_curve.protocol_fee_address;
        let reserve_ratio = ctx.accounts.bonding_curve.reserve_ratio;
        let initial_price = ctx.accounts.bonding_curve.initial_price;

        // Calculate price based on current supply
        let price = calculate_buy_price(
            purchase_market_supply,
            amount,
            buy_fee_percent,
            reserve_ratio,
            initial_price,
        )?;

        // Log the calculated price for debugging
        msg!(
            "Buying {} tokens for {} lamports ({} SOL)",
            amount,
            price,
            price as f64 / 1_000_000_000.0
        );

        // Log the buyer's SOL balance
        msg!(
            "Buyer has {} lamports ({} SOL)",
            **ctx.accounts.buyer.to_account_info().try_borrow_lamports()?,
            **ctx.accounts.buyer.to_account_info().try_borrow_lamports()? as f64 / 1_000_000_000.0
        );

        // Check if the using_native_sol account is a valid signer
        let is_using_native_sol = ctx.accounts.using_native_sol.is_signer;

        // If the user is using native SOL
        if is_using_native_sol {
            // Verify buyer has enough SOL
            require!(
                **ctx.accounts.buyer.to_account_info().try_borrow_lamports()? >= price,
                AttenomicsError::InsufficientFunds
            );

            // Instead of creating the WSOL account for the bonding curve, we'll use the buyer's WSOL account
            // which is already set up correctly. We'll transfer SOL to the buyer's WSOL account, then
            // transfer WSOL from the buyer's account to the bonding curve's WSOL account.

            // Transfer SOL from buyer to buyer's WSOL account
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.buyer_wsol_account.to_account_info(),
                    },
                ),
                price,
            )?;

            // Sync the account to recognize the SOL deposit as wrapped SOL
            anchor_spl::token::sync_native(CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::SyncNative {
                    account: ctx.accounts.buyer_wsol_account.to_account_info(),
                },
            ))?;

            // Transfer wrapped SOL from buyer's temporary account to bonding curve
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.buyer_wsol_account.to_account_info(),
                        to: ctx.accounts.bonding_curve_wsol_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                price,
            )?;
        } else {
            // Using already wrapped SOL - verify buyer has enough wrapped SOL
            require!(
                ctx.accounts.buyer_wsol_account.amount >= price,
                AttenomicsError::InsufficientFunds
            );

            // Transfer wrapped SOL from buyer to bonding curve
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.buyer_wsol_account.to_account_info(),
                        to: ctx.accounts.bonding_curve_wsol_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                price,
            )?;
        }

        // Mint tokens to buyer
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[&[
                    b"bonding-curve",
                    ctx.accounts.token_mint.key().as_ref(),
                    &[ctx.bumps.bonding_curve],
                ]],
            ),
            amount,
        )?;

        // Update bonding curve state
        ctx.accounts.bonding_curve.purchase_market_supply = ctx
            .accounts
            .bonding_curve
            .purchase_market_supply
            .checked_add(amount)
            .ok_or(AttenomicsError::ArithmeticError)?;

        // Emit event
        emit!(TokenBought {
            buyer: ctx.accounts.buyer.key(),
            token_mint: ctx.accounts.token_mint.key(),
            amount,
            price,
        });

        Ok(())
    }

    pub fn sell(ctx: Context<Sell>, amount: u64) -> Result<()> {
        // Get parameter values first before mutable borrows
        let purchase_market_supply = ctx.accounts.bonding_curve.purchase_market_supply;
        let sell_fee_percent = ctx.accounts.bonding_curve.sell_fee_percent;
        let protocol_fee_address = ctx.accounts.bonding_curve.protocol_fee_address;
        let reserve_ratio = ctx.accounts.bonding_curve.reserve_ratio;
        let initial_price = ctx.accounts.bonding_curve.initial_price;

        // Calculate sell price
        let sell_price = calculate_token_sell_price(
            purchase_market_supply,
            amount,
            sell_fee_percent,
            reserve_ratio,
            initial_price,
        );

        // Make sure bonding curve has enough wrapped SOL to pay the seller
        // Cap the sell price at the available balance if needed
        let available_wsol = ctx.accounts.bonding_curve_wsol_account.amount;

        // Ensure minimum price is at least 1 lamport for any non-zero token amount
        let min_price = if amount > 0 { 1 } else { 0 };
        let actual_sell_price = std::cmp::min(std::cmp::max(sell_price, min_price), available_wsol);

        require!(actual_sell_price > 0, AttenomicsError::InsufficientFunds);

        // Calculate fee
        let fee_amount = (sell_price * sell_fee_percent as u64) / 10000;
        let transfer_amount = sell_price - fee_amount;

        // Burn/Transfer tokens from seller to bonding curve
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            amount,
        )?;

        // Transfer wrapped SOL to the seller using PDA signing
        let token_mint_key = ctx.accounts.token_mint.key();
        let bonding_curve_seeds = &[
            b"bonding-curve",
            token_mint_key.as_ref(),
            &[ctx.bumps.bonding_curve],
        ];

        // anchor_lang::system_program::transfer(
        //     CpiContext::new_with_signer(
        //         ctx.accounts.system_program.to_account_info(),
        //         anchor_lang::system_program::Transfer {
        //             from: ctx.accounts.bonding_curve.to_account_info(),
        //             to: ctx.accounts.seller.to_account_info(),
        //         },
        //         &[bonding_curve_seeds],
        //     ),
        //     transfer_amount,
        // )?;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.bonding_curve_wsol_account.to_account_info(),
                    to: ctx.accounts.seller_wsol_account.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[bonding_curve_seeds],
            ),
            actual_sell_price,
        )?;

        // Update lifetime fees
        // if fee_amount > 0 {
        //     ctx.accounts.bonding_curve.lifetime_protocol_fees += fee_amount;

        // In a real implementation, we would transfer the fee to the protocol fee address
        // For testing purposes, we'll just log it
        //     msg!(
        //         "Fee of {} lamports would be sent to {}",
        //         fee_amount,
        //         protocol_fee_address
        //     );
        // }
        // Update the market supply
        ctx.accounts.bonding_curve.purchase_market_supply = ctx
            .accounts
            .bonding_curve
            .purchase_market_supply
            .checked_sub(amount)
            .ok_or(AttenomicsError::ArithmeticError)?;

        // Emit event
        emit!(TokenSold {
            seller: ctx.accounts.seller.key(),
            token_mint: ctx.accounts.token_mint.key(),
            amount,
            price: actual_sell_price,
        });

        Ok(())
    }

    pub fn initialize_swap_router(ctx: Context<InitializeSwapRouter>) -> Result<()> {
        let swap_router = &mut ctx.accounts.swap_router;
        swap_router.authority = ctx.accounts.authority.key();
        swap_router.initialized = true;

        emit!(SwapRouterInitialized {
            router: ctx.accounts.swap_router.key(),
            authority: ctx.accounts.authority.key(),
        });

        Ok(())
    }

    pub fn swap_tokens(
        ctx: Context<SwapTokens>,
        amount_in: u64,
        min_amount_out: u64,
    ) -> Result<()> {
        // Verify swap router is initialized
        require!(
            ctx.accounts.swap_router.initialized,
            AttenomicsError::NotInitialized
        );

        // Get parameter values
        let source_supply = ctx.accounts.source_bonding_curve.purchase_market_supply;
        let source_fee_percent = ctx.accounts.source_bonding_curve.sell_fee_percent;
        let source_reserve_ratio = ctx.accounts.source_bonding_curve.reserve_ratio;
        let source_initial_price = ctx.accounts.source_bonding_curve.initial_price;

        let target_supply = ctx.accounts.target_bonding_curve.purchase_market_supply;
        let target_fee_percent = ctx.accounts.target_bonding_curve.buy_fee_percent;
        let target_reserve_ratio = ctx.accounts.target_bonding_curve.reserve_ratio;
        let target_initial_price = ctx.accounts.target_bonding_curve.initial_price;
        const VIRTUAL_TOKEN_SUPPLY: u64 = 10_000_000_000_000_000; // 10M tokens * 10^9

        // Step 1: Calculate sell price for source token
        let sol_from_source = calculate_token_sell_price(
            source_supply,
            amount_in,
            source_fee_percent,
            source_reserve_ratio,
            source_initial_price,
        );

        // Step 2: Calculate buy amount for target token
        let expected_amount_out = calculate_token_buy_amount(
            target_supply,
            sol_from_source,
            target_fee_percent,
            target_reserve_ratio,
            target_initial_price,
        );

        // Verify minimum output
        require!(
            expected_amount_out >= min_amount_out,
            AttenomicsError::SlippageExceeded
        );

        // Verify target supply cap
        require!(
            target_supply + expected_amount_out <= VIRTUAL_TOKEN_SUPPLY,
            AttenomicsError::InsufficientVirtualSupply
        );

        // Step 3: Execute swap
        // 1. Burn source tokens
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.source_token_mint.to_account_info(),
                    from: ctx.accounts.user_source_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;

        // 2. Update source bonding curve supply
        let source_curve = &mut ctx.accounts.source_bonding_curve;
        source_curve.purchase_market_supply = source_curve
            .purchase_market_supply
            .checked_sub(amount_in)
            .ok_or(AttenomicsError::ArithmeticError)?;

        // 3. Transfer WSOL from source to target bonding curve
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx
                        .accounts
                        .source_bonding_curve_wsol_account
                        .to_account_info(),
                    to: ctx
                        .accounts
                        .target_bonding_curve_wsol_account
                        .to_account_info(),
                    authority: ctx.accounts.source_bonding_curve.to_account_info(),
                },
                &[&[
                    b"bonding-curve",
                    ctx.accounts.source_token_mint.key().as_ref(),
                    &[ctx.bumps.source_bonding_curve],
                ]],
            ),
            sol_from_source,
        )?;

        // 4. Mint target tokens
        let target_curve = &mut ctx.accounts.target_bonding_curve;
        target_curve.purchase_market_supply = target_curve
            .purchase_market_supply
            .checked_add(expected_amount_out)
            .ok_or(AttenomicsError::ArithmeticError)?;

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.target_token_mint.to_account_info(),
                    to: ctx.accounts.user_target_token_account.to_account_info(),
                    authority: ctx.accounts.target_bonding_curve.to_account_info(),
                },
                &[&[
                    b"bonding-curve",
                    ctx.accounts.target_token_mint.key().as_ref(),
                    &[ctx.bumps.target_bonding_curve],
                ]],
            ),
            expected_amount_out,
        )?;

        emit!(TokensSwapped {
            user: ctx.accounts.user.key(),
            source_token: ctx.accounts.source_token_mint.key(),
            target_token: ctx.accounts.target_token_mint.key(),
            amount_in,
            amount_out: expected_amount_out,
            sol_amount: sol_from_source,
        });

        Ok(())
    }
    // pub fn update_bonding_curve(
    //     ctx: Context<UpdateBondingCurve>,
    //     reserve_ratio: u64,
    //     initial_price: u64,
    // ) -> Result<()> {
    //     let bonding_curve = &mut ctx.accounts.bonding_curve;

    //     // Only the creator can update their bonding curve
    //     require!(
    //         ctx.accounts.creator.key() == ctx.accounts.creator_token_account.creator,
    //         AttenomicsError::Unauthorized
    //     );

    //     // Ensure the bonding curve belongs to this creator token
    //     require!(
    //         bonding_curve.token_mint == ctx.accounts.creator_token_account.token_mint,
    //         AttenomicsError::Unauthorized
    //     );

    //     // Minimum valid values to prevent issues
    //     require!(
    //         reserve_ratio >= 100000,
    //         AttenomicsError::InvalidBondingCurveParameters
    //     );
    //     require!(
    //         initial_price >= 1000000,
    //         AttenomicsError::InvalidBondingCurveParameters
    //     ); // At least 0.001 SOL

    //     // Update the parameters
    //     bonding_curve.reserve_ratio = reserve_ratio;
    //     bonding_curve.initial_price = initial_price;

    //     emit!(BondingCurveUpdated {
    //         token_mint: bonding_curve.token_mint,
    //         reserve_ratio,
    //         initial_price,
    //         creator: ctx.accounts.creator.key(),
    //     });

    //     Ok(())
    // }

    // pub fn provide_liquidity(ctx: Context<ProvideLiquidity>, amount: u64) -> Result<()> {
    //     require!(amount > 0, AttenomicsError::ArithmeticError);

    //     // Transfer tokens from provider to bonding curve
    //     token::transfer(
    //         CpiContext::new(
    //             ctx.accounts.token_program.to_account_info(),
    //             token::Transfer {
    //                 from: ctx.accounts.provider_token_account.to_account_info(),
    //                 to: ctx.accounts.curve_token_account.to_account_info(),
    //                 authority: ctx.accounts.provider.to_account_info(),
    //             },
    //         ),
    //         amount,
    //     )?;

    //     msg!(
    //         "Provided {} tokens as liquidity to the bonding curve",
    //         amount
    //     );

    //     Ok(())
    // }

    // pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
    //     // Verify caller is the protocol fee address
    //     require!(
    //         ctx.accounts.caller.key() == ctx.accounts.bonding_curve.protocol_fee_address,
    //         AttenomicsError::Unauthorized
    //     );

    //     // Get bonding curve SOL balance
    //     let balance = **ctx
    //         .accounts
    //         .bonding_curve
    //         .to_account_info()
    //         .try_borrow_lamports()?;
    //     require!(balance > 0, AttenomicsError::InsufficientFunds);

    //     // Transfer all SOL from bonding curve to fee address
    //     let bonding_curve_info = ctx.accounts.bonding_curve.to_account_info();
    //     let fee_address_info = ctx.accounts.fee_address.to_account_info();

    //     let mut from_lamports = bonding_curve_info.try_borrow_mut_lamports()?;
    //     let mut to_lamports = fee_address_info.try_borrow_mut_lamports()?;

    //     **to_lamports = to_lamports
    //         .checked_add(balance)
    //         .ok_or(AttenomicsError::ArithmeticError)?;

    //     **from_lamports = 0;

    //     msg!(
    //         "Withdrew {} lamports in fees to {}",
    //         balance,
    //         ctx.accounts.fee_address.key()
    //     );

    //     Ok(())
    // }

    // pub fn get_tokens_for_sol(ctx: Context<GetTokensForSol>, sol_amount: u64) -> Result<u64> {
    //     let supply = ctx.accounts.bonding_curve.purchase_market_supply;
    //     let fee_percent = ctx.accounts.bonding_curve.buy_fee_percent;
    //     let reserve_ratio = ctx.accounts.bonding_curve.reserve_ratio;
    //     let initial_price = ctx.accounts.bonding_curve.initial_price;

    //     let adjusted_sol = (sol_amount * 10000) / (10000 + fee_percent as u64);
    //     if adjusted_sol == 0 {
    //         return Ok(0);
    //     }

    //     let tokens = calculate_token_buy_amount(
    //         supply,
    //         adjusted_sol,
    //         0, // No fee, we already adjusted the SOL amount
    //         reserve_ratio,
    //         initial_price,
    //     );

    //     Ok(tokens)
    // }

    // pub fn get_sol_for_tokens(ctx: Context<GetSolForTokens>, token_amount: u64) -> Result<u64> {
    //     let supply = ctx.accounts.bonding_curve.purchase_market_supply;
    //     let fee_percent = ctx.accounts.bonding_curve.sell_fee_percent;
    //     let reserve_ratio = ctx.accounts.bonding_curve.reserve_ratio;
    //     let initial_price = ctx.accounts.bonding_curve.initial_price;

    //     // Cannot sell more tokens than the effective supply
    //     require!(token_amount <= supply, AttenomicsError::InsufficientFunds);

    //     let raw_price = calculate_token_sell_price(
    //         supply,
    //         token_amount,
    //         0, // Calculate without fees first
    //         reserve_ratio,
    //         initial_price,
    //     );

    //     // Subtract fee from the price
    //     let fee = (raw_price * fee_percent as u64) / 10000;

    //     Ok(raw_price - fee)
    // }

    // pub fn distribute_tokens(
    //     ctx: Context<DistributeTokens>,
    //     recipients: Vec<Pubkey>,
    //     amounts: Vec<u64>,
    // ) -> Result<()> {
    //     // Verify caller is the AI agent
    //     require!(
    //         ctx.accounts.signer.key() == ctx.accounts.supporter_contract.ai_agent,
    //         AttenomicsError::Unauthorized
    //     );

    //     // Verify the parameters
    //     require!(
    //         recipients.len() == amounts.len(),
    //         AttenomicsError::InvalidInput
    //     );
    //     require!(!recipients.is_empty(), AttenomicsError::InvalidInput);

    //     // Calculate total distribution amount
    //     let mut total_amount = 0;
    //     for amount in &amounts {
    //         total_amount += amount;
    //     }

    //     // Store bump for signing
    //     let (_, bump) = Pubkey::find_program_address(
    //         &[
    //             b"supporter-contract",
    //             ctx.accounts.token_mint.key().as_ref(),
    //         ],
    //         &ID,
    //     );

    //     // Process each recipient
    //     for i in 0..recipients.len() {
    //         let _recipient = recipients[i]; // Mark as intentionally unused since we're using the account directly
    //         let amount = amounts[i];

    //         // Skip zero amount transfers
    //         if amount == 0 {
    //             continue;
    //         }

    //         // Create token mint reference for the signing seeds
    //         let token_mint_ref = ctx.accounts.token_mint.key();

    //         // Create transfer instruction
    //         token::transfer(
    //             CpiContext::new_with_signer(
    //                 ctx.accounts.token_program.to_account_info(),
    //                 token::Transfer {
    //                     from: ctx.accounts.supporter_token_account.to_account_info(),
    //                     to: ctx.accounts.recipient_token_account.to_account_info(),
    //                     authority: ctx.accounts.supporter_contract.to_account_info(),
    //                 },
    //                 &[&[b"supporter-contract", token_mint_ref.as_ref(), &[bump]]],
    //             ),
    //             amount,
    //         )?;
    //     }

    //     // Update total distributed
    //     ctx.accounts.supporter_contract.total_distributed += total_amount;

    //     Ok(())
    // }

    // pub fn distribute_with_signature(
    //     ctx: Context<DistributeWithSignature>,
    //     data_hash: [u8; 32],
    //     signature: [u8; 64],
    //     recipients: Vec<Pubkey>,
    //     amounts: Vec<u64>,
    // ) -> Result<()> {
    //     // Verify signature account hasn't been used before
    //     let signature_account = &ctx.accounts.signature_account;

    //     require!(
    //         !signature_account.used,
    //         AttenomicsError::SignatureAlreadyUsed
    //     );

    //     // Verify the parameters
    //     require!(
    //         recipients.len() == amounts.len(),
    //         AttenomicsError::InvalidInput
    //     );
    //     require!(!recipients.is_empty(), AttenomicsError::InvalidInput);

    //     // Create message to verify signature
    //     // The message is: recipient address + amount + signature seed
    //     let mut message = Vec::new();
    //     message.extend_from_slice(ctx.accounts.recipient.key().as_ref());
    //     message.extend_from_slice(&amounts[0].to_le_bytes());
    //     message.extend_from_slice(&data_hash[..]);

    //     // Hash the message for verification
    //     let message_hash = hash(&message);

    //     // Get the AI agent public key
    //     let ai_agent_key = ctx.accounts.supporter_contract.ai_agent;

    //     // Create verification instruction data
    //     let num_signatures = 1;
    //     let _public_key_offset = 1 + 1 + (num_signatures * 64); // Mark as intentionally unused

    //     let mut instruction_data = vec![];
    //     instruction_data.push(num_signatures as u8);
    //     instruction_data.push(0 as u8); // signature offset, only used for multiple signatures

    //     // Add signature
    //     instruction_data.extend_from_slice(&signature);

    //     // Add pubkey
    //     instruction_data.extend_from_slice(&ai_agent_key.to_bytes());

    //     // Add message hash
    //     instruction_data.extend_from_slice(&message_hash.to_bytes());

    //     // Create ed25519 verification instruction
    //     let ed25519_ix = Instruction {
    //         program_id: ed25519_program::id(),
    //         accounts: vec![],
    //         data: instruction_data,
    //     };

    //     // Create verification IX account info
    //     let account_infos = vec![];

    //     // Verify the signature
    //     let result = anchor_lang::solana_program::program::invoke(&ed25519_ix, &account_infos);

    //     // Check if verification succeeded
    //     require!(result.is_ok(), AttenomicsError::InvalidSignature);

    //     // Mark signature as used
    //     let signature_account = &mut ctx.accounts.signature_account;
    //     signature_account.used = true;

    //     // Store token mint reference to avoid temporary value dropped error
    //     let token_mint_ref = ctx.accounts.token_mint.key();

    //     // Store bump for signing
    //     let (_, bump) = Pubkey::find_program_address(
    //         &[
    //             b"supporter-contract",
    //             ctx.accounts.token_mint.key().as_ref(),
    //         ],
    //         &ID,
    //     );

    //     // Calculate total amount to distribute
    //     let mut total_amount = 0;

    //     // Process each recipient
    //     for i in 0..recipients.len() {
    //         let amount = amounts[i];
    //         if amount == 0 {
    //             continue;
    //         }

    //         // Create transfer instruction
    //         token::transfer(
    //             CpiContext::new_with_signer(
    //                 ctx.accounts.token_program.to_account_info(),
    //                 token::Transfer {
    //                     from: ctx.accounts.supporter_token_account.to_account_info(),
    //                     to: ctx.accounts.recipient_token_account.to_account_info(),
    //                     authority: ctx.accounts.supporter_contract.to_account_info(),
    //                 },
    //                 &[&[b"supporter-contract", token_mint_ref.as_ref(), &[bump]]],
    //             ),
    //             amount,
    //         )?;

    //         total_amount += amount;
    //     }

    //     // Update total distributed
    //     ctx.accounts.supporter_contract.total_distributed += total_amount;

    //     Ok(())
    // }

    // #[access_control(validate_ai_agent(&ctx.accounts.ai_agent, &ctx.accounts.global_entry_point))]
    // pub fn drip_tokens(ctx: Context<DripTokens>) -> Result<()> {
    //     let supporter = &mut ctx.accounts.supporter_contract;
    //     let current_time = Clock::get()?.unix_timestamp;

    //     // Check if enough time has passed since last drip
    //     require!(
    //         current_time >= supporter.last_drip_time + supporter.distributor_config.drip_interval,
    //         AttenomicsError::TooEarly
    //     );

    //     // Calculate drip amount
    //     let drip_amount = supporter.distributor_config.daily_drip_amount;

    //     // Verify contract has enough tokens
    //     let balance = ctx.accounts.supporter_token_account.amount;
    //     require!(balance >= drip_amount, AttenomicsError::InsufficientFunds);

    //     // Update last drip time
    //     supporter.last_drip_time = current_time;

    //     // Transfer tokens to distribution pool
    //     token::transfer(
    //         CpiContext::new(
    //             ctx.accounts.token_program.to_account_info(),
    //             Transfer {
    //                 from: ctx.accounts.supporter_token_account.to_account_info(),
    //                 to: ctx.accounts.distribution_pool.to_account_info(),
    //                 authority: ctx.accounts.supporter_contract.to_account_info(),
    //             },
    //         ),
    //         drip_amount,
    //     )?;

    //     Ok(())
    // }
}

// Helper functions moved outside the impl block

/**
 * @notice Calculates the price for buying tokens from the bonding curve
 * @param supply Current token supply
 * @param amount Amount of tokens to buy
 * @param fee_percent Fee percentage in basis points (1/100 of 1%)
 * @param reserve_ratio Reserve ratio parameter for the curve
 * @param initial_price Initial price parameter for the curve
 * @return The price in lamports (including fees)
 *
 * Uses an exponential bonding curve: P = initial_price * e^(supply / reserve_ratio)
 * Price is the integral of the curve from current supply to supply + amount.
 */
pub fn calculate_buy_price(
    supply: u64,
    amount: u64,
    fee_percent: u16,
    _reserve_ratio: u64,
    initial_price: u64,
) -> Result<u64> {
    // Virtual reserve of 0.5 SOL (in lamports)
    const VIRTUAL_RESERVE_SOL: u64 = 500_000_000;
    // Initial virtual token supply
    const VIRTUAL_TOKEN_SUPPLY: u64 = 10_000_000;

    // Check for overflow
    require!(
        VIRTUAL_TOKEN_SUPPLY >= supply + amount,
        AttenomicsError::InsufficientVirtualSupply
    );

    // Calculate current SOL balance (virtual + real)
    let current_sol =
        VIRTUAL_RESERVE_SOL + (supply as u128 * initial_price as u128 / 1_000_000_000) as u64;

    // Calculate new SOL balance needed
    let new_sol = (current_sol as u128 * VIRTUAL_TOKEN_SUPPLY as u128)
        / (VIRTUAL_TOKEN_SUPPLY - supply - amount) as u128;

    // Calculate SOL needed
    let sol_needed = new_sol - current_sol as u128;

    // Add fee
    let total_with_fee = (sol_needed * (10000 + fee_percent as u128) / 10000) as u64;

    Ok(total_with_fee)
}
/**
 * @notice Calculates the token price at a specific supply point
 * @param supply Current token supply
 * @param initial_price Initial price parameter for the curve
 * @param reserve_ratio Reserve ratio parameter for the curve
 * @return The token price at that supply point in lamports
 *
 * Core function implementing the exponential bonding curve formula
 */
pub fn calculate_price_at_supply(supply: u64, initial_price: u64, _reserve_ratio: u64) -> u64 {
    // Virtual reserve of 0.5 SOL (in lamports)
    const VIRTUAL_RESERVE_SOL: u64 = 500_000_000;

    // Initial virtual token supply
    const VIRTUAL_TOKEN_SUPPLY: u64 = 10_000_000;

    // Calculate current SOL balance (virtual + real)
    let current_sol =
        VIRTUAL_RESERVE_SOL + (supply as u128 * initial_price as u128 / 1_000_000_000) as u64;

    // Calculate remaining token supply
    let remaining_supply = if supply >= VIRTUAL_TOKEN_SUPPLY {
        1 // Avoid division by zero
    } else {
        VIRTUAL_TOKEN_SUPPLY - supply
    };

    // Calculate price using constant product formula
    let price = (current_sol as u128 * VIRTUAL_TOKEN_SUPPLY as u128) / (remaining_supply as u128);

    // Convert to lamports (1 SOL = 1_000_000_000 lamports)
    (price * initial_price as u128 / VIRTUAL_TOKEN_SUPPLY as u128) as u64
}

/**
 * @notice Calculates the price for selling tokens back to the bonding curve
 * @param supply Current token supply
 * @param amount Amount of tokens to sell
 * @param fee_percent Fee percentage in basis points (1/100 of 1%)
 * @param reserve_ratio Reserve ratio parameter for the curve
 * @param initial_price Initial price parameter for the curve
 * @return The price in lamports (after fees are deducted)
 *
 * Uses the reverse of the buy function to calculate the sell price.
 */
fn calculate_token_sell_price(
    supply: u64,
    amount: u64,
    fee_percent: u16,
    reserve_ratio: u64,
    initial_price: u64,
) -> u64 {
    // For sell price, we're removing tokens, so supply will decrease
    if amount > supply {
        return 0; // Cannot sell more than available
    }

    // Calculate price at current supply
    let price_at_supply = calculate_price_at_supply(supply, initial_price, reserve_ratio);

    // Calculate price at final supply (after selling)
    let price_at_final = calculate_price_at_supply(supply - amount, initial_price, reserve_ratio);

    // Calculate area under curve for amount (selling works in reverse)
    // Use approximately the average of prices * amount
    let raw_price = ((price_at_supply + price_at_final) * amount) / 2;

    // Subtract fee
    let fee = (raw_price * fee_percent as u64) / 10000;
    if raw_price <= fee {
        return 0;
    }
    raw_price - fee
}

/**
 * @notice Calculates the amount of tokens that can be bought with a given SOL amount
 * @param supply Current token supply
 * @param sol_amount Amount of SOL to spend (in lamports)
 * @param fee_percent Fee percentage in basis points (1/100 of 1%)
 * @param reserve_ratio Reserve ratio parameter for the curve
 * @param initial_price Initial price parameter for the curve
 * @return The amount of tokens that can be purchased
 *
 * Uses binary search to find the token amount that costs exactly the given SOL amount.
 */
fn calculate_token_buy_amount(
    supply: u64,
    sol_amount: u64,
    fee_percent: u16,
    _reserve_ratio: u64,
    initial_price: u64,
) -> u64 {
    // Virtual reserve of 0.5 SOL (in lamports)
    const VIRTUAL_RESERVE_SOL: u64 = 500_000_000;

    // Initial virtual token supply
    const VIRTUAL_TOKEN_SUPPLY: u64 = 10_000_000;

    // Account for fee
    let adjusted_sol = (sol_amount * 10000) / (10000 + fee_percent as u64);
    if adjusted_sol == 0 {
        return 0;
    }

    // Calculate current SOL balance (virtual + real)
    let current_sol =
        VIRTUAL_RESERVE_SOL + (supply as u128 * initial_price as u128 / 1_000_000_000) as u64;

    // Calculate new SOL balance after purchase
    let new_sol = current_sol + adjusted_sol;

    // Calculate token amount using constant product formula
    let current_tokens = VIRTUAL_TOKEN_SUPPLY - supply;
    let new_tokens = (current_tokens as u128 * current_sol as u128) / new_sol as u128;

    // Return difference in tokens
    (current_tokens - new_tokens as u64).min(800_000_000 - supply) // Cap at 800M tokens
}

// Events
#[event]
pub struct AIAgentUpdated {
    pub agent: Pubkey,
    pub allowed: bool,
}

#[event]
pub struct CreatorTokenDeployed {
    pub creator: Pubkey,
    pub token_address: Pubkey,
    pub handle: [u8; 32],
    pub token_id: u64,
}

// New Events
#[event]
pub struct SwapRouterInitialized {
    pub router: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct TokensSwapped {
    pub user: Pubkey,
    pub source_token: Pubkey,
    pub target_token: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub sol_amount: u64,
}

#[event]
pub struct BondingCurveUpdated {
    pub token_mint: Pubkey,
    pub reserve_ratio: u64,
    pub initial_price: u64,
    pub creator: Pubkey,
}

#[event]
pub struct TokenBought {
    pub buyer: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub price: u64,
}

#[event]
pub struct TokenSold {
    pub seller: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub price: u64,
}

// Accounts
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
         init,
         payer = authority,
         space = 8 + size_of::<AttenomicsEntryPoint>(),
         seeds = [b"entry-point"],
         bump
     )]
    pub entry_point: Account<'info, AttenomicsEntryPoint>,

    /// CHECK: This is the gaslite drop address
    pub gaslite_drop: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAiAgent<'info> {
    #[account(mut)]
    pub entry_point: Account<'info, AttenomicsEntryPoint>,

    #[account(
         init_if_needed,
         payer = authority,
         space = 8 + size_of::<AIAgentAccount>(),
         seeds = [b"ai-agent", agent.key().as_ref()],
         bump
     )]
    pub agent_account: Account<'info, AIAgentAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: This is the AI agent address being registered
    pub agent: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(config: TokenConfig)]
pub struct DeployCreatorToken<'info> {
    #[account(mut)]
    pub entry_point: Account<'info, AttenomicsEntryPoint>,

    #[account(
         init_if_needed,
         payer = creator,
         space = 8 + size_of::<CreatorTokenAccount>() + 200, // Extra space for strings
         seeds = [b"creator-token", config.handle.as_ref()],
         bump
     )]
    pub creator_token_account: Account<'info, CreatorTokenAccount>,

    #[account(
         init_if_needed,
         payer = creator,
         space = 8 + size_of::<NFTAccount>() + 200, // Extra space for metadata URI
         seeds = [b"nft", entry_point.next_token_id.to_le_bytes().as_ref()],
         bump
     )]
    pub nft_account: Account<'info, NFTAccount>,

    #[account(
         seeds = [b"ai-agent", config.ai_agent.as_ref()],
         bump,
     )]
    pub ai_agent_account: Account<'info, AIAgentAccount>,

    // Initialize the SelfTokenVault PDA
    #[account(
         init,
         payer = creator,
         space = 8 + size_of::<SelfTokenVault>() + 100, // Extra space for config
         seeds = [b"self-token-vault", token_mint.key().as_ref()],
         bump
     )]
    pub self_token_vault: Account<'info, SelfTokenVault>,

    // Initialize the BondingCurve PDA
    #[account(
         init,
         payer = creator,
         space = 8 + size_of::<BondingCurve>() + 100, // Extra space for config
         seeds = [b"bonding-curve", token_mint.key().as_ref()],
         bump
     )]
    pub bonding_curve: Account<'info, BondingCurve>,

    // Initialize the CreatorTokenSupporter PDA
    #[account(
         init,
         payer = creator,
         space = 8 + size_of::<CreatorTokenSupporter>() + 100, // Extra space for config
         seeds = [b"supporter-contract", token_mint.key().as_ref()],
         bump
     )]
    pub supporter_contract: Account<'info, CreatorTokenSupporter>,

    #[account(
         init,
         payer = creator,
         mint::decimals = 9,
         mint::authority = bonding_curve.key(),
     )]
    pub token_mint: Account<'info, Mint>,

    // #[account(
    //     init_if_needed,
    //     payer = creator,
    //     associated_token::mint = token_mint,
    //     associated_token::authority = self_token_vault,
    // )]
    // pub vault_token_account: Account<'info, TokenAccount>,

    // #[account(
    //     init_if_needed,
    //     payer = creator,
    //     associated_token::mint = token_mint,
    //     associated_token::authority = supporter_contract,
    // )]
    // pub supporter_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintInitialTokens<'info> {
    #[account(
        seeds = [b"creator-token", creator_token_account.handle.as_ref()],
        bump
    )]
    pub creator_token_account: Account<'info, CreatorTokenAccount>,

    #[account(
        seeds = [b"bonding-curve", token_mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = self_token_vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = supporter_contract,
    )]
    pub supporter_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"self-token-vault", token_mint.key().as_ref()],
        bump
    )]
    pub self_token_vault: Account<'info, SelfTokenVault>,

    #[account(
        seeds = [b"supporter-contract", token_mint.key().as_ref()],
        bump
    )]
    pub supporter_contract: Account<'info, CreatorTokenSupporter>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetHandleHash<'info> {
    /// CHECK: Not a real account, just a signer
    pub signer: Signer<'info>,
}

#[derive(Accounts, Clone)]
pub struct AvailableForWithdrawal<'info> {
    pub self_token_vault: Account<'info, SelfTokenVault>,
}

#[derive(Accounts, Clone)]
pub struct Withdraw<'info> {
    #[account(
         mut,
         seeds = [b"self-token-vault", token_mint.key().as_ref()],
         bump,
     )]
    pub self_token_vault: Account<'info, SelfTokenVault>,

    #[account(
         mut,
         associated_token::mint = token_mint,
         associated_token::authority = self_token_vault,
     )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
         mut,
         associated_token::mint = token_mint,
         associated_token::authority = creator,
     )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    #[account(
         constraint = creator.key() == self_token_vault.creator @ AttenomicsError::Unauthorized
     )]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// State Accounts
/**
 * @notice Main entry point account for the protocol
 * Stores global configuration and tracks token ID counter
 */
#[account]
pub struct AttenomicsEntryPoint {
    pub authority: Pubkey,            // Owner of the entry point
    pub gaslite_drop_address: Pubkey, // Gaslite drop address
    pub protocol_fee_address: Pubkey, // Protocol fee address
    pub next_token_id: u64,           // Counter for NFT token IDs
}

/**
 * @notice Stores information about registered AI agents
 * AI agents are trusted entities that can perform certain privileged operations
 */
#[account]
pub struct AIAgentAccount {
    pub agent: Pubkey, // AI agent address
    pub allowed: bool, // Whether the agent is allowed
}

/**
 * @notice Stores creator token metadata and references to its components
 * This is the core account for each creator token, linking all related accounts
 */
#[account]
pub struct CreatorTokenAccount {
    pub handle: [u8; 32],         // Hashed Twitter/X handle
    pub creator: Pubkey,          // Creator address
    pub token_mint: Pubkey,       // Creator token mint address
    pub ai_agent: Pubkey,         // AI agent address
    pub total_supply: u128,       // Total token supply
    pub self_percent: u8,         // Percentage allocated to self
    pub market_percent: u8,       // Percentage allocated to market
    pub supporter_percent: u8,    // Percentage allocated to supporters
    pub token_id: u64,            // Associated NFT token ID
    pub name: String,             // Token name
    pub symbol: String,           // Token symbol
    pub nft_metadata_uri: String, // NFT metadata URI
    pub initialized: bool,        // Whether the account is initialized
    // Reference fields that link to other components
    pub self_token_vault: Pubkey,   // Address of the SelfTokenVault
    pub bonding_curve: Pubkey,      // Address of the BondingCurve
    pub supporter_contract: Pubkey, // Address of the CreatorTokenSupporter
}

/**
 * @notice Tracks creator token NFT metadata
 * Each creator token has an associated NFT representing ownership
 */
#[account]
pub struct NFTAccount {
    pub owner: Pubkey,         // NFT owner
    pub token_id: u64,         // NFT token ID
    pub metadata_uri: String,  // Metadata URI
    pub creator_token: Pubkey, // Associated creator token
}

/**
 * @notice Manages creator token vesting
 * Handles the vesting schedule for tokens allocated to the creator
 */
#[account]
pub struct SelfTokenVault {
    pub token_mint: Pubkey,        // Creator token mint address
    pub creator: Pubkey,           // Creator address
    pub initial_balance: u128,     // Initial token balance
    pub withdrawn: u64,            // Amount withdrawn
    pub start_time: i64,           // Timestamp when vesting started
    pub initialized: bool,         // Whether the vault is initialized
    pub vault_config: VaultConfig, // Vault configuration
}

/**
 * @notice Implements the bonding curve mechanics
 * Handles token price discovery, buying, and selling logic
 */
#[account]
pub struct BondingCurve {
    pub token_mint: Pubkey,           // Creator token mint address
    pub protocol_fee_address: Pubkey, // Protocol fee address
    pub buy_fee_percent: u16,         // Buy fee in basis points (e.g. 50 = 0.5%)
    pub sell_fee_percent: u16,        // Sell fee in basis points (e.g. 100 = 1%)
    pub purchase_market_supply: u64,  // Effective supply for pricing
    pub lifetime_protocol_fees: u64,  // Fees collected
    pub reserve_ratio: u64,           // Reserve ratio - controls curve steepness (lower = steeper)
    pub initial_price: u64,           // Initial price in lamports
}

/**
 * @notice Manages token distribution to supporters
 * Handles distribution of tokens allocated to community supporters
 */
#[account]
pub struct CreatorTokenSupporter {
    pub token_mint: Pubkey,
    pub ai_agent: Pubkey,
    pub gaslite_drop_address: Pubkey,
    pub total_distributed: u64,
    pub distributor_config: DistributorConfig,
    pub last_drip_time: i64,
}

/**
 * @notice Configuration for token vesting
 * Defines the schedule for token release from the vault
 */
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VaultConfig {
    pub drip_percentage: u8, // Percentage of locked tokens to release per interval
    pub drip_interval: i64,  // Interval between drips in seconds
    pub lock_time: i64,      // Lock period in seconds
    pub locked_percentage: u8, // Percentage of tokens subject to vesting
}

/**
 * @notice Configuration for supporter token distribution
 * Defines the schedule for distributing tokens to supporters
 */
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DistributorConfig {
    pub daily_drip_amount: u64, // Amount of tokens to distribute per day
    pub drip_interval: i64,     // Interval between drips in seconds
    pub total_days: u16,        // Total number of days for distribution
}

/**
 * @notice Token configuration for deployment
 * Defines the initial settings for a new creator token
 */
#[account]
pub struct TokenConfig {
    pub total_supply: u128,    // Total token supply as numeric value
    pub self_percent: u8,      // Percentage allocated to creator
    pub market_percent: u8,    // Percentage allocated to market
    pub supporter_percent: u8, // Percentage allocated to supporters
    pub handle: [u8; 32],      // Hashed creator handle/username
    pub ai_agent: Pubkey,      // Associated AI agent
}

/**
 * @notice Router for token-to-token swaps
 * Facilitates swapping between different creator tokens
 */
#[account]
pub struct SwapRouter {
    pub authority: Pubkey, // Owner of the swap router
    pub initialized: bool, // Whether the router is initialized
}

/**
 * @notice Tracks used signatures for distribute_with_signature
 * Prevents replay attacks by marking used signatures
 */
#[account]
pub struct SignatureAccount {
    pub used: bool, // Whether the signature has been used
}

// New Account Contexts
#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(
         mut,
         seeds = [b"bonding-curve", token_mint.key().as_ref()],
         bump,
     )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
         mut,
         constraint = token_mint.mint_authority.contains(&bonding_curve.key()) @ AttenomicsError::Unauthorized
     )]
    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
         init_if_needed,
         payer = buyer,
         associated_token::mint = token_mint,
         associated_token::authority = buyer,
     )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// The wrapped SOL mint
    #[account(address = WRAPPED_SOL_MINT)]
    pub wsol_mint: Account<'info, Mint>,

    /// Buyer's wrapped SOL account
    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_wsol_account: Account<'info, TokenAccount>,

    /// Bonding curve's wrapped SOL account
    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_wsol_account: Account<'info, TokenAccount>,

    /// Flag to indicate if the buyer is using native SOL or wrapped SOL
    /// Changed to a signer check instead of a boolean to avoid anchor issues
    #[account(mut)]
    pub using_native_sol: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(
        mut,
        seeds = [b"bonding-curve", token_mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(mut)] // Changed from non-mutable
    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
         mut,
         associated_token::mint = token_mint,
         associated_token::authority = seller,
     )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// The wrapped SOL mint
    #[account(address = WRAPPED_SOL_MINT)]
    pub wsol_mint: Account<'info, Mint>,

    /// Seller's wrapped SOL account
    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = seller,
    )]
    pub seller_wsol_account: Account<'info, TokenAccount>,

    /// Bonding curve's wrapped SOL account
    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_wsol_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeSwapRouter<'info> {
    #[account(
         init,
         payer = authority,
         space = 8 + size_of::<SwapRouter>(),
         seeds = [b"swap-router"],
         bump
     )]
    pub swap_router: Account<'info, SwapRouter>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SwapTokens<'info> {
    #[account(
        seeds = [b"swap-router"],
        bump
    )]
    pub swap_router: Account<'info, SwapRouter>,
    #[account(
        mut,
        seeds = [b"bonding-curve", source_token_mint.key().as_ref()],
        bump
    )]
    pub source_bonding_curve: Account<'info, BondingCurve>,
    #[account(mut)]
    pub source_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"bonding-curve", target_token_mint.key().as_ref()],
        bump
    )]
    pub target_bonding_curve: Account<'info, BondingCurve>,
    #[account(mut)]
    pub target_token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = source_token_mint,
        associated_token::authority = user
    )]
    pub user_source_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = target_token_mint,
        associated_token::authority = user
    )]
    pub user_target_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = source_bonding_curve
    )]
    pub source_bonding_curve_wsol_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = target_bonding_curve
    )]
    pub target_bonding_curve_wsol_account: Account<'info, TokenAccount>,
    #[account(address = WRAPPED_SOL_MINT)]
    pub wsol_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
// New State Account
#[derive(Accounts)]
pub struct UpdateBondingCurve<'info> {
    #[account(mut)]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub creator_token_account: Account<'info, CreatorTokenAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProvideLiquidity<'info> {
    #[account(
         mut,
         seeds = [b"bonding-curve", token_mint.key().as_ref()],
         bump,
     )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub provider: Signer<'info>,

    #[account(
         mut,
         associated_token::mint = token_mint,
         associated_token::authority = provider,
     )]
    pub provider_token_account: Account<'info, TokenAccount>,

    #[account(
         mut,
         associated_token::mint = token_mint,
         associated_token::authority = bonding_curve,
     )]
    pub curve_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(mut)]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(mut)]
    pub caller: Signer<'info>,

    /// CHECK: This is the protocol fee address that receives the fees
    #[account(
         mut,
         constraint = caller.key() == bonding_curve.protocol_fee_address @ AttenomicsError::Unauthorized
     )]
    pub fee_address: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetTokensForSol<'info> {
    pub bonding_curve: Account<'info, BondingCurve>,

    pub token_mint: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct GetSolForTokens<'info> {
    pub bonding_curve: Account<'info, BondingCurve>,

    pub token_mint: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct DistributeTokens<'info> {
    #[account(
         mut,
         seeds = [b"supporter-contract", token_mint.key().as_ref()],
         bump,
     )]
    pub supporter_contract: Account<'info, CreatorTokenSupporter>,

    #[account(
         mut,
         associated_token::mint = token_mint,
         associated_token::authority = supporter_contract,
     )]
    pub supporter_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    /// CHECK: This is a recipient address
    pub recipient: UncheckedAccount<'info>,

    #[account(
         mut,
         associated_token::mint = token_mint,
         associated_token::authority = recipient,
     )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    #[account(
         constraint = signer.key() == supporter_contract.ai_agent @ AttenomicsError::Unauthorized
     )]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(data_hash: [u8; 32])]
pub struct DistributeWithSignature<'info> {
    #[account(
         mut,
         seeds = [b"supporter-contract", token_mint.key().as_ref()],
         bump,
     )]
    pub supporter_contract: Account<'info, CreatorTokenSupporter>,

    #[account(
         mut,
         associated_token::mint = token_mint,
         associated_token::authority = supporter_contract,
     )]
    pub supporter_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    /// CHECK: This is a recipient address
    pub recipient: UncheckedAccount<'info>,

    #[account(
         mut,
         associated_token::mint = token_mint,
         associated_token::authority = recipient,
     )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    #[account(
         init_if_needed,
         payer = payer,
         space = 8 + size_of::<SignatureAccount>(),
         seeds = [b"signature", data_hash.as_ref()],
         bump
     )]
    pub signature_account: Account<'info, SignatureAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DripTokens<'info> {
    #[account(mut)]
    pub supporter_contract: Account<'info, CreatorTokenSupporter>,

    #[account(
         mut,
         constraint = supporter_token_account.mint == supporter_contract.token_mint,
         constraint = supporter_token_account.owner == supporter_contract.key()
     )]
    pub supporter_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub distribution_pool: Account<'info, TokenAccount>,

    pub ai_agent: Account<'info, AIAgent>,
    pub global_entry_point: Account<'info, GlobalEntryPoint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Error Codes
#[error_code]
pub enum AttenomicsError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Handle already used")]
    HandleAlreadyUsed,
    #[msg("AI agent not allowed")]
    AIAgentNotAllowed,
    #[msg("Invalid gaslite drop address")]
    InvalidGasliteDropAddress,
    #[msg("Invalid percentage split")]
    InvalidPercentageSplit,
    #[msg("No tokens available for withdrawal")]
    NoTokensAvailable,
    #[msg("Arithmetic error")]
    ArithmeticError,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Insufficient funds in bonding curve")]
    InsufficientFundsInCurve,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Not initialized")]
    NotInitialized,
    #[msg("Invalid bonding curve parameters")]
    InvalidBondingCurveParameters,
    #[msg("Missing signer")]
    MissingSigner,
    #[msg("Invalid input parameters")]
    InvalidInput,
    #[msg("Signature already used")]
    SignatureAlreadyUsed,
    #[msg("Invalid signature")]
    InvalidSignature,
    #[msg("Invalid vault config")]
    InvalidVaultConfig,
    #[msg("Invalid distributor config")]
    InvalidDistributorConfig,
    #[msg("Too early")]
    TooEarly,
    #[msg("Inactive AI agent")]
    InactiveAIAgent,
    #[msg("Invalid AI agent")]
    InvalidAIAgent,
    #[msg("Insufficient virtual token supply for purchase")]
    InsufficientVirtualSupply,
}

#[account]
pub struct AIAgent {
    pub authority: Pubkey,
    pub is_active: bool,
}

#[account]
pub struct GlobalEntryPoint {
    pub authority: Pubkey,
    pub is_initialized: bool,
}

fn validate_ai_agent(
    ai_agent: &Account<AIAgent>,
    global_entry_point: &Account<GlobalEntryPoint>,
) -> Result<()> {
    require!(ai_agent.is_active, AttenomicsError::InactiveAIAgent);
    require!(
        ai_agent.authority == global_entry_point.authority,
        AttenomicsError::InvalidAIAgent
    );
    Ok(())
}
