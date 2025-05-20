use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};

declare_id!("3CkB1YhoBxHG9uZXJ3fDkjshjb9nXdFQkLSKKNYz9vX7");

#[program]
pub mod payroll_standard {
    use super::*;

    // Initialize payroll vault
    pub fn initialize_payroll(
        ctx: Context<InitializePayroll>,
        payroll_id: String,
        payment_token: Pubkey,
        tax_rate: u16,
    ) -> Result<()> {
        let payroll = &mut ctx.accounts.payroll;

        payroll.authority = ctx.accounts.authority.key();
        payroll.payroll_id = payroll_id;
        payroll.payment_token = payment_token;
        payroll.employee_count = 0;
        payroll.is_active = true;
        payroll.tax_rate = tax_rate;
        payroll.total_funds = 0;
        Ok(())
    }

    // Add employee to payroll
    pub fn add_employee(
        ctx: Context<AddEmployee>,
        employee_id: String,
        salary_amount: u64,
        payment_frequency: PaymentFrequency,
        deductions: u64, // New: Support deductions
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
        employee.deductions = deductions;
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
            deductions,
        });

        Ok(())
    }

    // Process payroll payment
    pub fn process_payment(ctx: Context<ProcessPayment>, employee_id: String) -> Result<()> {
        let payroll = &mut ctx.accounts.payroll;
        let employee = &mut ctx.accounts.employee;
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

        // Calculate net payment (salary - taxes - deductions)
        let tax_amount = (employee.salary_amount as u128)
            .checked_mul(payroll.tax_rate as u128)
            .ok_or(PayrollError::ArithmeticOverflow)?
            / 10_000;
        let net_payment = employee
            .salary_amount
            .checked_sub(tax_amount as u64)
            .ok_or(PayrollError::ArithmeticOverflow)?
            .checked_sub(employee.deductions)
            .ok_or(PayrollError::ArithmeticOverflow)?;

        require!(
            payroll.total_funds >= net_payment,
            PayrollError::InsufficientFunds
        );

        let payroll_bump = ctx.bumps.payroll;
        let id_bytes = payroll.payroll_id.as_bytes();
        let seeds = &[b"payroll", id_bytes, &[payroll_bump]];
        let signer_seeds = &[&seeds[..]];

        // Use token transfer instead of system transfer for SPL tokens
        let transfer_instruction = Transfer {
            from: ctx.accounts.payroll_vault.to_account_info(),
            to: ctx.accounts.employee_wallet.to_account_info(),
            authority: payroll.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, transfer_instruction).with_signer(signer_seeds);

        anchor_spl::token::transfer(cpi_ctx, employee.salary_amount)?;

        // Update payroll and employee records
        payroll.total_funds = payroll
            .total_funds
            .checked_sub(net_payment)
            .ok_or(PayrollError::ArithmeticOverflow)?;
        employee.last_payment = clock.unix_timestamp;

        emit!(PaymentProcessed {
            payroll_id: payroll.payroll_id.clone(),
            employee_id,
            amount: net_payment,
            tax_amount: tax_amount as u64,
            deductions: employee.deductions,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    // Update employee details
    pub fn update_employee(
        ctx: Context<UpdateEmployee>,
        salary_amount: u64,
        payment_frequency: PaymentFrequency,
        deductions: u64,
        is_active: bool,
    ) -> Result<()> {
        let payroll = &ctx.accounts.payroll;
        let employee = &mut ctx.accounts.employee;
        require!(payroll.is_active, PayrollError::PayrollInactive);
        require!(salary_amount > 0, PayrollError::InvalidSalaryAmount);

        employee.salary_amount = salary_amount;
        employee.payment_frequency = payment_frequency;
        employee.deductions = deductions;
        employee.is_active = is_active;

        emit!(EmployeeUpdated {
            payroll_id: ctx.accounts.payroll.payroll_id.clone(),
            employee_id: employee.employee_id.clone(),
            salary_amount,
            deductions,
            is_active,
        });

        Ok(())
    }

    // Deposit funds to payroll vault
    pub fn deposit_funds(ctx: Context<DepositFunds>, amount: u64) -> Result<()> {
        let payroll = &mut ctx.accounts.payroll;

        let transfer_instruction = Transfer {
            from: ctx.accounts.authority_token_account.to_account_info(),
            to: ctx.accounts.payroll_vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, transfer_instruction);

        anchor_spl::token::transfer(cpi_ctx, amount)?;

        payroll.total_funds = payroll
            .total_funds
            .checked_add(amount)
            .ok_or(PayrollError::ArithmeticOverflow)?;

        emit!(FundsDeposited {
            payroll_id: payroll.payroll_id.clone(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // New: Pause payroll
    pub fn pause_payroll(ctx: Context<PausePayroll>) -> Result<()> {
        let payroll = &mut ctx.accounts.payroll;
        require!(payroll.is_active, PayrollError::PayrollInactive);
        payroll.is_active = false;

        emit!(PayrollPaused {
            payroll_id: payroll.payroll_id.clone(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // New: Resume payroll
    pub fn resume_payroll(ctx: Context<PausePayroll>) -> Result<()> {
        let payroll = &mut ctx.accounts.payroll;
        require!(!payroll.is_active, PayrollError::PayrollActive);
        payroll.is_active = true;

        emit!(PayrollResumed {
            payroll_id: payroll.payroll_id.clone(),
            timestamp: Clock::get()?.unix_timestamp,
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
        mut,
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

#[derive(Accounts)]
pub struct DepositFunds<'info> {
    #[account(mut, has_one = authority, has_one = payment_token)]
    pub payroll: Account<'info, Payroll>,
    #[account(mut)]
    pub payroll_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority_token_account: Account<'info, TokenAccount>,
    pub payment_token: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PausePayroll<'info> {
    #[account(mut, has_one = authority)]
    pub payroll: Account<'info, Payroll>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Payroll {
    pub authority: Pubkey,
    pub payroll_id: String,
    pub payment_token: Pubkey,
    pub employee_count: u64,
    pub is_active: bool,
    pub tax_rate: u16,
    pub total_funds: u64,
}

#[account]
pub struct Employee {
    pub payroll: Pubkey,
    pub employee_id: String,
    pub wallet: Pubkey,
    pub salary_amount: u64,
    pub deductions: u64,
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
    #[msg("Payroll is already active")]
    PayrollActive,
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
    #[msg("Invalid payroll ID")]
    InvalidPayrollId,
    #[msg("Invalid salary amount")]
    InvalidSalaryAmount,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
}

#[event]
pub struct EmployeeAdded {
    pub payroll_id: String,
    pub employee_id: String,
    pub wallet: Pubkey,
    pub salary_amount: u64,
    pub deductions: u64,
}

#[event]
pub struct PaymentProcessed {
    pub payroll_id: String,
    pub employee_id: String,
    pub amount: u64,
    pub tax_amount: u64,
    pub deductions: u64,
    pub timestamp: i64,
}

#[event]
pub struct EmployeeUpdated {
    pub payroll_id: String,
    pub employee_id: String,
    pub salary_amount: u64,
    pub deductions: u64,
    pub is_active: bool,
}

#[event]
pub struct FundsDeposited {
    pub payroll_id: String,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct PayrollPaused {
    pub payroll_id: String,
    pub timestamp: i64,
}

#[event]
pub struct PayrollResumed {
    pub payroll_id: String,
    pub timestamp: i64,
}

// Constants for account sizes
impl Payroll {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        4 + 64 + // payroll_id
        32 + // payment_token
        8 + // employee_count
        1 + // is_active
        2 + // tax_rate
        8; // total_funds
}

impl Employee {
    pub const LEN: usize = 8 + // discriminator
        32 + // payroll
        4 + 64 + // employee_id
        32 + // wallet
        8 + // salary_amount
        8 + // deductions
        1 + // payment_frequency
        8 + // last_payment
        1; // is_active
}
